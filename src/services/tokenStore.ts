// Persistance locale du token GitHub, pour éviter d'avoir à le recoller à chaque
// ouverture de l'app. Le token est stocké dans les stockages du navigateur et
// envoyé directement à api.github.com dans les requêtes authentifiées.
//
// V1.2 : IndexedDB seul s'est révélé peu fiable sur iOS en usage PWA (bugs WebKit
// documentés — échec à la première ouverture, perte de connexion à la base après
// mise en arrière-plan). On garde IndexedDB en stockage principal, mais on ajoute
// localStorage en secours redondant : plus simple, sans transaction, donc moins
// sujet à ce type de panne. Le token n'est ni plus ni moins exposé dans un cas que
// dans l'autre (les deux sont réservés à l'origine du site) — c'est un choix de
// fiabilité, pas une protection contre un script malveillant exécuté sur cette origine.

const DB_NAME = 'treeport-store'
const STORE_NAME = 'kv'
const TOKEN_KEY = 'github-token'
const LOCAL_STORAGE_KEY = 'treeporter:github-token'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Ouvre la base avec une nouvelle tentative : un bug WebKit connu fait parfois
// échouer la toute première ouverture d'IndexedDB après le chargement de la page,
// alors qu'une seconde tentative immédiate réussit.
async function openDbWithRetry(): Promise<IDBDatabase> {
  try {
    return await openDb()
  } catch {
    return openDb()
  }
}

function readLocalStorage(): string | null {
  try {
    return window.localStorage.getItem(LOCAL_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeLocalStorage(token: string): boolean {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, token)
    return true
  } catch {
    // Quota dépassé ou navigation privée : pas bloquant, IndexedDB reste tenté à côté.
    return false
  }
}

function clearLocalStorage(): void {
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch {
    // rien à faire si indisponible
  }
}

export async function saveToken(token: string): Promise<void> {
  // Écrit dans les deux stockages : d'abord localStorage (plus fiable),
  // puis IndexedDB (stockage principal). Si localStorage échoue, on tente
  // quand même IndexedDB pour avoir au moins un stockage de secours.
  const localStorageOk = writeLocalStorage(token)
  try {
    const db = await openDbWithRetry()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(token, TOKEN_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB indisponible : si localStorage a réussi, on a quand même
    // une sauvegarde. Sinon, aucune des deux méthodes n'a fonctionné.
    if (!localStorageOk) {
      console.warn('Treeporter: Failed to save token to both IndexedDB and localStorage')
    }
  }
}

export async function loadToken(): Promise<string | null> {
  let indexedDBToken: string | null = null
  let localStorageToken: string | null = null

  try {
    const db = await openDbWithRetry()
    indexedDBToken = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(TOKEN_KEY)
      req.onsuccess = () => resolve((req.result as string) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
  } catch {
    // IndexedDB indisponible
  }

  localStorageToken = readLocalStorage()

  // Si IndexedDB a un token, on le retourne (stockage principal)
  if (indexedDBToken) {
    // Si localStorage n'a pas le même token, on le synchronise
    if (localStorageToken !== indexedDBToken) {
      writeLocalStorage(indexedDBToken)
    }
    return indexedDBToken
  }

  // Sinon, on retourne ce que localStorage a (secours)
  return localStorageToken
}

export async function clearToken(): Promise<void> {
  clearLocalStorage()
  try {
    const db = await openDbWithRetry()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(TOKEN_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // rien à faire si le stockage est indisponible
  }
}
