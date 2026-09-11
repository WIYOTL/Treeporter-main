import type { RepoRef, BranchRef, UploadItem, UploadStep, SendResult } from '../types'
import type { GitProvider, CommitPlan, CommitCallbacks, PullRequestResult } from './gitProvider'
import { GitDockError } from './gitProvider'
import { fileToBase64 } from './base64'
import { joinTargetPath } from './fileTree'
import { detectTokenType } from './tokenType'

const API = 'https://api.github.com'

// Encode chaque segment d'un nom de branche séparément, en conservant les "/"
// littéraux du chemin d'API (ex. "feature/inventaire" -> "feature/inventaire",
// pas "feature%2Finventaire"). L'API GitHub route /git/ref/heads/<branche> et
// /git/refs/heads/<branche> en traitant le "/" comme un séparateur de chemin,
// pas comme un caractère à encoder.
function encodeBranchPath(branchName: string): string {
  return branchName.split('/').map(encodeURIComponent).join('/')
}

// Logique de message d'erreur partagée entre le chemin fetch() (gh()) et le chemin
// XMLHttpRequest (uploadBlobWithProgress, pour la progression à l'octet des gros fichiers) —
// une seule source de vérité pour ne jamais avoir deux messages différents pour la même erreur.
function deriveErrorMessage(
  status: number,
  statusText: string,
  bodyMessage: string | undefined,
  cleanToken: string,
  rateLimitRemaining: string | null
): string {
  let message = bodyMessage || `${status} ${statusText}`

  if (status === 401) {
    const type = detectTokenType(cleanToken)
    if (type === 'fine-grained') {
      message =
        "Token invalide, expiré, ou incomplet. Les tokens fine-grained expirent obligatoirement (1 an max) " +
        "et sont longs à copier sur iPhone — vérifie sur github.com qu'il n'a pas expiré, et qu'il a bien été " +
        'collé en entier.'
    } else {
      message = 'Token invalide ou expiré.'
    }
  }
  if (status === 403 && rateLimitRemaining === '0') {
    message = "Limite de requêtes GitHub atteinte, réessaie dans quelques minutes."
  } else if (status === 403) {
    message = "Permissions insuffisantes pour ce dépôt — vérifie que le token a bien l'accès « Contents : Read and write »."
  }
  if (status === 404) message = "Introuvable — dépôt ou branche supprimé(e), ou droits insuffisants du token."

  return message
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  // Un copier-coller depuis Notes/le trousseau iOS peut ajouter un espace ou un retour
  // à la ligne invisible en fin de token, qui provoque un 401 "Bad credentials" trompeur.
  const cleanToken = token.trim()

  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    })
  } catch {
    // fetch() rejette (pas de réponse HTTP du tout) en cas de coupure réseau, DNS, etc. —
    // le message natif du navigateur ("Failed to fetch") n'est pas compréhensible tel quel.
    throw new GitDockError('Connexion impossible — vérifie ta connexion internet et réessaie.')
  }

  if (!res.ok) {
    let bodyMessage: string | undefined
    try {
      const body = await res.json()
      bodyMessage = body?.message
    } catch {
      // pas de corps JSON exploitable
    }
    const message = deriveErrorMessage(
      res.status,
      res.statusText,
      bodyMessage,
      cleanToken,
      res.headers.get('x-ratelimit-remaining')
    )
    throw new GitDockError(message, undefined, res.status)
  }

  return res.json() as Promise<T>
}

// Upload avec progression à l'octet près — utilisé uniquement pour la création de blob
// (l'étape qui envoie le contenu réel des fichiers, donc la seule où la taille de la
// requête peut être significative). fetch() ne donne aucun événement de progression pour
// l'upload ; XMLHttpRequest est le seul mécanisme navigateur qui le permette de façon fiable.
function uploadBlobWithProgress<T>(
  token: string,
  path: string,
  bodyObj: unknown,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<T> {
  const cleanToken = token.trim()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${cleanToken}`)
    xhr.setRequestHeader('Accept', 'application/vnd.github+json')
    xhr.setRequestHeader('X-GitHub-Api-Version', '2022-11-28')
    xhr.setRequestHeader('Content-Type', 'application/json')

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total)
      }
    }

    xhr.onerror = () => {
      // Même cas que le catch de fetch() dans gh() : coupure réseau, DNS, etc.
      reject(new GitDockError('Connexion impossible — vérifie ta connexion internet et réessaie.'))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new GitDockError('Réponse GitHub invalide.'))
        }
      } else {
        let bodyMessage: string | undefined
        try {
          bodyMessage = JSON.parse(xhr.responseText)?.message
        } catch {
          // pas de corps JSON exploitable
        }
        const message = deriveErrorMessage(
          xhr.status,
          xhr.statusText,
          bodyMessage,
          cleanToken,
          xhr.getResponseHeader('x-ratelimit-remaining')
        )
        reject(new GitDockError(message, undefined, xhr.status))
      }
    }

    xhr.send(JSON.stringify(bodyObj))
  })
}

const START_STEPS: UploadStep[] = [
  { id: 'files', label: 'Envoi des fichiers', status: 'pending' },
  { id: 'tree', label: "Construction de l'arborescence", status: 'pending' },
  { id: 'commit', label: 'Création du commit', status: 'pending' },
  { id: 'ref', label: 'Mise à jour de la branche', status: 'pending' },
]

export class GitHubClient implements GitProvider {
  // Clé = "owner/repo#idFichier" : chaque dépôt a son propre espace de blobs.
  // Un SHA de blob n'a de sens que dans le dépôt où il a été créé — sans ce
  // scoping, changer de dépôt cible après un envoi partiel réutiliserait par
  // erreur des SHA valides seulement dans l'ancien dépôt.
  private blobCache = new Map<string, string>()

  constructor(private token: string) {
    this.token = token.trim()
  }

  private cacheKey(repo: RepoRef, fileId: string): string {
    return `${repo.fullName}#${fileId}`
  }

  async validateToken(): Promise<{ login: string }> {
    const user = await gh<{ login: string }>(this.token, '/user')
    return { login: user.login }
  }

  async listRepos(): Promise<RepoRef[]> {
    // Récupère toutes les pages, pas seulement les 100 dépôts les plus récents.
    const all: any[] = []
    let page = 1
    // Garde-fou raisonnable (5000 dépôts) pour éviter une boucle infinie en cas de réponse inattendue.
    while (page <= 50) {
      const batch = await gh<any[]>(this.token, `/user/repos?per_page=100&sort=updated&page=${page}`)
      all.push(...batch)
      if (batch.length < 100) break
      page += 1
    }
    return all.map((r) => ({
      owner: r.owner.login,
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      canPush: Boolean(r.permissions?.push),
    }))
  }

  async listBranches(repo: RepoRef): Promise<string[]> {
    const branches = await gh<any[]>(this.token, `/repos/${repo.fullName}/branches?per_page=100`)
    return branches.map((b) => b.name)
  }

  async listExistingPaths(repo: RepoRef, branch: BranchRef): Promise<Set<string>> {
    // Branche pas encore créée : rien ne peut être en conflit.
    if (branch.isNew) return new Set()
    try {
      const ref = await gh<{ object: { sha: string } }>(
        this.token,
        `/repos/${repo.fullName}/git/ref/heads/${encodeBranchPath(branch.name)}`
      )
      const tree = await gh<{ tree: Array<{ path: string; type: string }> }>(
        this.token,
        `/repos/${repo.fullName}/git/trees/${ref.object.sha}?recursive=1`
      )
      return new Set(tree.tree.filter((e) => e.type === 'blob').map((e) => e.path))
    } catch (err) {
      // Dépôt/branche vide (pas encore de commit) : aucun conflit possible, on n'empêche pas l'envoi.
      if (err instanceof GitDockError && err.status === 404) return new Set()
      throw err
    }
  }

  async createPullRequest(repo: RepoRef, branch: BranchRef, title: string): Promise<PullRequestResult> {
    const pr = await gh<{ html_url: string; number: number }>(this.token, `/repos/${repo.fullName}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        head: branch.name,
        base: repo.defaultBranch,
      }),
    })
    return { url: pr.html_url, number: pr.number }
  }

  async commit(plan: CommitPlan, callbacks: CommitCallbacks, onlyItemIds?: string[]): Promise<SendResult> {
    const steps = START_STEPS.map((s) => ({ ...s }))
    const emitSteps = () => callbacks.onSteps(steps.map((s) => ({ ...s })))

    const eligible = plan.files.filter((f) => !f.excluded)
    const idsToAttempt = new Set(onlyItemIds ?? eligible.map((f) => f.id))

    const items: UploadItem[] = eligible.map((f) => ({
      id: f.id,
      path: f.renamedPath ?? joinTargetPath(plan.targetPath, f.relativePath),
      size: f.size,
      status: this.blobCache.has(this.cacheKey(plan.repo, f.id)) ? 'done' : idsToAttempt.has(f.id) ? 'pending' : 'error',
    }))
    const emitItems = () => callbacks.onItems(items.map((i) => ({ ...i })))

    emitSteps()
    emitItems()
    steps[0].status = 'uploading'
    emitSteps()

    for (const docked of eligible) {
      if (!idsToAttempt.has(docked.id) || this.blobCache.has(this.cacheKey(plan.repo, docked.id))) continue
      const item = items.find((i) => i.id === docked.id)!
      item.status = 'uploading'
      item.bytesSent = 0
      emitItems()
      try {
        const content = await fileToBase64(docked.file)
        let lastEmit = 0
        const blob = await uploadBlobWithProgress<{ sha: string }>(
          this.token,
          `/repos/${plan.repo.fullName}/git/blobs`,
          { content, encoding: 'base64' },
          (loadedBytes, totalBytes) => {
            // Throttle : un événement de progression peut se déclencher très fréquemment,
            // inutile de re-rendre l'interface plus de 10 fois par seconde.
            const now = Date.now()
            if (now - lastEmit < 100 && loadedBytes < totalBytes) return
            lastEmit = now
            // loadedBytes/totalBytes portent sur le corps encodé en base64 (~33 % plus gros
            // que le fichier d'origine) — on ramène la progression à la taille réelle du
            // fichier pour qu'elle corresponde à ce qui est affiché à l'utilisateur.
            item.bytesSent = Math.min(docked.size, Math.round((loadedBytes / totalBytes) * docked.size))
            emitItems()
          }
        )
        this.blobCache.set(this.cacheKey(plan.repo, docked.id), blob.sha)
        item.status = 'done'
        item.bytesSent = docked.size
      } catch (err) {
        item.status = 'error'
        item.error = err instanceof Error ? err.message : "Échec de l'envoi"
      }
      emitItems()
    }

    const anyFailed = items.some((i) => i.status === 'error')
    if (anyFailed) {
      steps[0].status = 'error'
      emitSteps()
      throw new GitDockError('INCOMPLETE')
    }
    steps[0].status = 'done'
    emitSteps()

    // --- construction de l'arbre, du commit, mise à jour de la branche ---
    steps[1].status = 'uploading'
    emitSteps()

    const baseBranchName = plan.branch.isNew ? plan.repo.defaultBranch : plan.branch.name
    const baseRef = await gh<{ object: { sha: string } }>(
      this.token,
      `/repos/${plan.repo.fullName}/git/ref/heads/${encodeBranchPath(baseBranchName)}`
    )
    const baseSha = baseRef.object.sha
    const baseCommit = await gh<{ tree: { sha: string } }>(
      this.token,
      `/repos/${plan.repo.fullName}/git/commits/${baseSha}`
    )

    const treeEntries = items.map((i) => ({
      path: i.path,
      mode: '100644',
      type: 'blob',
      sha: this.blobCache.get(this.cacheKey(plan.repo, i.id)),
    }))

    const tree = await gh<{ sha: string }>(this.token, `/repos/${plan.repo.fullName}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
    })
    steps[1].status = 'done'
    emitSteps()

    steps[2].status = 'uploading'
    emitSteps()
    const commit = await gh<{ sha: string }>(this.token, `/repos/${plan.repo.fullName}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: plan.commitMessage,
        tree: tree.sha,
        parents: [baseSha],
      }),
    })
    steps[2].status = 'done'
    emitSteps()

    steps[3].status = 'uploading'
    emitSteps()
    if (plan.branch.isNew) {
      await gh(this.token, `/repos/${plan.repo.fullName}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${plan.branch.name}`, sha: commit.sha }),
      })
    } else {
      await gh(this.token, `/repos/${plan.repo.fullName}/git/refs/heads/${encodeBranchPath(plan.branch.name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha }),
      })
    }
    steps[3].status = 'done'
    emitSteps()

    return {
      commitSha: commit.sha,
      commitUrl: `https://github.com/${plan.repo.fullName}/commit/${commit.sha}`,
      filesSent: items.length,
      filesFailed: 0,
    }
  }
}
