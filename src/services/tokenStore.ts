// Persistance locale du token GitHub, pour éviter d'avoir à le recoller à chaque
// ouverture de l'app. Le token ne quitte jamais l'appareil : il n'est écrit que
// dans le stockage local du navigateur, jamais envoyé ailleurs qu'à api.github.com.
//
// V1.2 : IndexedDB seul s'est révélé peu fiable sur iOS en usage PWA (bugs WebKit
// documentés — échec à la première ouverture, perte de connexion à la base après
// mise en arrière-plan). On garde IndexedDB en stockage principal, mais on ajoute
// localStorage en secours redondant : plus simple, sans transaction, donc moins
// sujet à ce type de panne. Le token n'est ni plus ni moins exposé dans un cas que
// dans l'autre (les deux sont réservés à l'origine du site, comme expliqué dans le
// README) — c'est un choix de fiabilité, pas de sécurité.

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

function writeLocalStorage(token: string): void {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, token)
  } catch {
    // Quota dépassé ou navigation privée : pas bloquant, IndexedDB reste tenté à côté.
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
  // Écrit dans les deux stockages en parallèle : chacun peut échouer indépendamment
  // sans empêcher l'autre de réussir.
  writeLocalStorage(token)
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
    // IndexedDB indisponible : le secours localStorage écrit plus haut suffit.
  }
}

export async function loadToken(): Promise<string | null> {
  try {
    const db = await openDbWithRetry()
    const token = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(TOKEN_KEY)
      req.onsuccess = () => resolve((req.result as string) ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    if (token) return token
  } catch {
    // IndexedDB indisponible ou vide : on retombe sur le secours ci-dessous.
  }
  return readLocalStorage()
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
