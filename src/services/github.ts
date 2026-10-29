import type { RepoRef, BranchRef, DockedFile, UploadItem, UploadStep, SendResult } from '../types'
import type { GitProvider, CommitPlan, CommitCallbacks, PullRequestResult } from './gitProvider'
import { GitDockError } from './gitProvider'
import { fileToBase64 } from './base64'
import { joinTargetPath, splitFilesIntoBatches, MAX_RECOMMENDED_COMMIT_SIZE_BYTES, MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT } from './fileTree'
import { messageFromError } from '../i18n/message'
import type { MessageDescriptor } from '../i18n/message'
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
  headers: Pick<Headers, 'get'>,
  cleanToken: string,
  path: string,
  method: string
): MessageDescriptor {
  const safeBodyMessage = redactToken(bodyMessage, cleanToken)
  const detail = safeBodyMessage || `${status} ${statusText}`

  if (status === 401) {
    return { key: 'errors.authenticationFailed', detail }
  }

  const retryAfterSeconds = getRetryAfterSeconds(headers)
  const rateLimitRemaining = headers.get('x-ratelimit-remaining')
  const isRateLimited = status === 429 || rateLimitRemaining === '0' || retryAfterSeconds !== undefined || /rate.?limit/i.test(safeBodyMessage || '')
  if (isRateLimited && (status === 403 || status === 429)) {
    return retryAfterSeconds && retryAfterSeconds > 0
      ? { key: 'errors.rateLimitWait', values: { seconds: retryAfterSeconds }, detail: safeBodyMessage }
      : { key: 'errors.rateLimit', detail: safeBodyMessage }
  }

  if (status === 409) {
    return { key: 'errors.conflict', detail: safeBodyMessage }
  }

  if (status === 422) {
    return { key: 'errors.validation', detail: safeBodyMessage }
  }

  if (status >= 500) {
    return { key: 'errors.serverError', detail: safeBodyMessage }
  }

  if (status === 403 || status === 404) {
    const ssoStatus = headers.get('x-github-sso')
    if (ssoStatus && /^required\b/i.test(ssoStatus)) {
      return { key: 'errors.ssoRequired', detail: redactToken(ssoStatus, cleanToken) }
    }

    const acceptedPermissions = redactToken(headers.get('x-accepted-github-permissions')?.trim(), cleanToken)
    const acceptedScopes = redactToken(headers.get('x-accepted-oauth-scopes')?.trim(), cleanToken)

    if (acceptedPermissions && acceptedScopes) {
      return {
        key: 'errors.permissionsAndScopesRequired',
        values: { permissions: acceptedPermissions, scopes: acceptedScopes },
        detail: safeBodyMessage,
      }
    }
    if (acceptedPermissions) {
      return { key: 'errors.permissionsRequired', values: { permissions: acceptedPermissions }, detail: safeBodyMessage }
    }
    if (acceptedScopes) {
      return { key: 'errors.classicScopesRequired', values: { scopes: acceptedScopes }, detail: safeBodyMessage }
    }

    // GitHub's documented CORS headers may hide X-Accepted-GitHub-Permissions
    // from browser code. Use a route-specific hint for recognized PAT formats,
    // without using prefix detection to allow or reject authentication.
    const fineGrainedHint = getFineGrainedPermissionHint(method, path)
    const tokenType = detectTokenType(cleanToken)
    if (fineGrainedHint && tokenType === 'fine-grained') {
      if (status === 404 && !path.startsWith('/repos/')) {
        return { key: 'errors.githubRequest', detail: safeBodyMessage }
      }
      return {
        key: status === 404 ? 'errors.fineGrainedNotFoundHint' : 'errors.fineGrainedPermissionHint',
        values: { permissions: fineGrainedHint },
        detail: safeBodyMessage,
      }
    }
    const classicScopeHint = 'repo (private repositories) or public_repo (public repositories)'
    if (tokenType === 'classic' && path.startsWith('/repos/')) {
      return {
        key: status === 404 ? 'errors.classicNotFoundHint' : 'errors.classicPermissionHint',
        values: { scopes: classicScopeHint },
        detail: safeBodyMessage,
      }
    }

    if (status === 403) return { key: 'errors.permissions', detail: safeBodyMessage }
    return { key: 'errors.notFound', detail: safeBodyMessage }
  }

  return { key: 'errors.githubRequest', detail }
}

function getFineGrainedPermissionHint(method: string, path: string): string | undefined {
  const verb = method.toUpperCase()
  const route = path.split('?')[0]

  if (route === '/user/repos' && verb === 'GET') return 'Metadata: read'
  if (/^\/repos\/[^/]+\/[^/]+\/branches$/.test(route) && verb === 'GET') return 'Contents: read'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/ref\//.test(route) && verb === 'GET') return 'Contents: read'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/trees\/[^/]+$/.test(route) && verb === 'GET') return 'Contents: read'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/commits\/[^/]+$/.test(route) && verb === 'GET') return 'Contents: read'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/blobs$/.test(route) && verb === 'POST') return 'Contents: write'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/trees$/.test(route) && verb === 'POST') return 'Contents: write'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/commits$/.test(route) && verb === 'POST') return 'Contents: write'
  if (/^\/repos\/[^/]+\/[^/]+\/git\/refs(?:\/.*)?$/.test(route) && (verb === 'POST' || verb === 'PATCH')) {
    return 'Contents: write; Workflows: write may also be needed for workflow files'
  }
  if (/^\/repos\/[^/]+\/[^/]+\/pulls$/.test(route) && verb === 'POST') return 'Pull requests: write'

  return undefined
}

function redactToken(value: string | undefined, cleanToken: string): string | undefined {
  if (!value || !cleanToken) return value
  return value.split(cleanToken).join('[redacted]')
}

function getRetryAfterSeconds(headers: Pick<Headers, 'get'>): number | undefined {
  const retryAfter = headers.get('retry-after')
  if (retryAfter !== null) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)

    const retryAt = Date.parse(retryAfter)
    if (Number.isFinite(retryAt)) return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
  }

  if (headers.get('x-ratelimit-remaining') === '0') {
    const resetAt = Number(headers.get('x-ratelimit-reset'))
    if (Number.isFinite(resetAt) && resetAt > 0) {
      return Math.max(0, Math.ceil((resetAt * 1000 - Date.now()) / 1000))
    }
  }

  return undefined
}

// L'API GitHub des references Git (PATCH /git/refs/{ref}) ne propose pas de mise
// a jour conditionnelle (If-Match, ETag ou comparateur de SHA). Il n'existe donc
// aucune garantie atomique : une petite fenetre de concurrence subsiste entre la
// lecture du SHA courant et l'ecriture. Cette fonction applique le meilleur
// protective disponible : relire la reference, la comparer au SHA attendu, puis
// ne PATCHer que si elle correspond. En cas de divergence, la branche cible est
// preservee et une erreur 409 est levee.
async function verifyAndPatchRef(
  token: string,
  repo: RepoRef,
  branch: BranchRef,
  expectedSha: string,
  newSha: string
): Promise<void> {
  const currentRef = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${repo.fullName}/git/ref/heads/${encodeBranchPath(branch.name)}`
  )
  if (currentRef.object.sha !== expectedSha) {
    throw new GitDockError(
      'Conflit de branche',
      undefined,
      409,
      { key: 'errors.conflict', detail: 'La branche cible a ete modifiee pendant le transfert. Reessayez l\'envoi.' }
    )
  }
  await gh(token, `/repos/${repo.fullName}/git/refs/heads/${encodeBranchPath(branch.name)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newSha }),
  })
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
    throw new GitDockError('Network request failed', undefined, undefined, { key: 'errors.network' })
  }

  if (!res.ok) {
    let bodyMessage: string | undefined
    try {
      const body = await res.json()
      bodyMessage = body?.message
    } catch {
      // pas de corps JSON exploitable
    }
    const userMessage = deriveErrorMessage(
      res.status,
      res.statusText,
      bodyMessage,
      res.headers,
      cleanToken,
      path,
      init?.method ?? 'GET'
    )
    console.error('Treeporter GitHub request failed', {
      method: init?.method ?? 'GET',
      path,
      status: res.status,
      message: redactToken(bodyMessage, cleanToken),
    })
    throw new GitDockError(redactToken(bodyMessage, cleanToken) || `${res.status} ${res.statusText}`, undefined, res.status, userMessage)
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
      reject(new GitDockError('Network request failed', undefined, undefined, { key: 'errors.network' }))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new GitDockError('Invalid JSON response', undefined, undefined, { key: 'errors.invalidGithubResponse' }))
        }
      } else {
        let bodyMessage: string | undefined
        try {
          bodyMessage = JSON.parse(xhr.responseText)?.message
        } catch {
          // pas de corps JSON exploitable
        }
        const userMessage = deriveErrorMessage(
          xhr.status,
          xhr.statusText,
          bodyMessage,
          { get: (name) => xhr.getResponseHeader(name) },
          cleanToken,
          path,
          'POST'
        )
        console.error('Treeporter GitHub blob upload failed', {
          method: 'POST',
          path,
          status: xhr.status,
          message: redactToken(bodyMessage, cleanToken),
        })
        reject(new GitDockError(redactToken(bodyMessage, cleanToken) || `${xhr.status} ${xhr.statusText}`, undefined, xhr.status, userMessage))
      }
    }

    xhr.send(JSON.stringify(bodyObj))
  })
}

const START_STEPS: UploadStep[] = [
  { id: 'files', label: 'sending.uploadStep', status: 'pending' },
  { id: 'tree', label: 'sending.treeStep', status: 'pending' },
  { id: 'commit', label: 'sending.commitStep', status: 'pending' },
  { id: 'ref', label: 'sending.branchStep', status: 'pending' },
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
      // This is the authenticated account's repository role, not proof that a
      // fine-grained PAT itself has Contents: write. Leave unknown when omitted.
      canPush: typeof r.permissions?.push === 'boolean' ? r.permissions.push : undefined,
    }))
  }

  async listBranches(repo: RepoRef): Promise<string[]> {
    const all: any[] = []
    let page = 1
    while (true) {
      const batch = await gh<any[]>(this.token, `/repos/${repo.fullName}/branches?per_page=100&page=${page}`)
      all.push(...batch)
      if (batch.length < 100) break
      page += 1
    }
    return all.map((b) => b.name)
  }

  async listExistingPaths(repo: RepoRef, branch: BranchRef): Promise<Set<string>> {
    // A newly selected branch has no existing paths. For an existing branch, a
    // 404 can also mean GitHub is hiding a private resource the token cannot read.
    if (branch.isNew) return new Set()

    const ref = await gh<{ object: { sha: string } }>(
      this.token,
      `/repos/${repo.fullName}/git/ref/heads/${encodeBranchPath(branch.name)}`
    )
    const tree = await gh<{ tree: Array<{ path: string; type: string }> }>(
      this.token,
      `/repos/${repo.fullName}/git/trees/${ref.object.sha}?recursive=1`
    )
    return new Set(tree.tree.filter((e) => e.type === 'blob').map((e) => e.path))
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

  /**
   * Crée un seul commit avec un batch de fichiers.
   * Méthode interne utilisée par commit() pour le fractionnement.
   * Si parentCommitSha est null, récupère le commit de base depuis la branche.
   */
  private async _commitSingleBatch(
    plan: CommitPlan,
    batchFiles: DockedFile[],
    parentCommitSha: string | null,
    callbacks: CommitCallbacks,
    batchIndex: number,
    totalBatches: number
  ): Promise<{ commitSha: string; treeSha: string; baseSha: string; filesSent: number; filesFailed: number }> {
    const steps = START_STEPS.map((s) => ({ ...s }))
    const emitSteps = () => callbacks.onSteps(steps.map((s) => ({ ...s })))

    const eligible = batchFiles.filter((f) => !f.excluded)
    const idsToAttempt = new Set(eligible.map((f) => f.id))

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

    // Charger tous les fichiers de ce batch
    // Utiliser un bloc pour chaque fichier afin de libérer la mémoire (ArrayBuffer + Base64 string) après upload
    for (const docked of eligible) {
      if (!idsToAttempt.has(docked.id) || this.blobCache.has(this.cacheKey(plan.repo, docked.id))) continue
      const item = items.find((i) => i.id === docked.id)!
      item.status = 'uploading'
      item.bytesSent = 0
      emitItems()

      // Traiter chaque fichier dans un bloc pour limiter la portée des variables mémoire
      try {
        // Ne pas utiliser const pour permettre la libération explicite
        let content: string | null = await fileToBase64(docked.file)
        try {
          let lastEmit = 0
          const blob = await uploadBlobWithProgress<{ sha: string }>(
            this.token,
            `/repos/${plan.repo.fullName}/git/blobs`,
            { content, encoding: 'base64' },
            (loadedBytes, totalBytes) => {
              const now = Date.now()
              if (now - lastEmit < 100 && loadedBytes < totalBytes) return
              lastEmit = now
              item.bytesSent = Math.min(docked.size, Math.round((loadedBytes / totalBytes) * docked.size))
              emitItems()
            }
          )
          this.blobCache.set(this.cacheKey(plan.repo, docked.id), blob.sha)
          item.status = 'done'
          item.bytesSent = docked.size
        } finally {
          // Libérer explicitement la référence à content pour permettre le garbage collection
          // La string Base64 peut occuper ~133% de la taille du fichier
          content = null
        }
      } catch (err) {
        item.status = 'error'
        item.error = messageFromError(err, 'errors.fileUpload')
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

    // Construction de l'arbre - récupérer baseTreeSha depuis parentCommitSha
    steps[1].status = 'uploading'
    emitSteps()

    let parentTreeSha: string

    if (parentCommitSha) {
      // On a déjà le SHA du parent commit, récupérer son arbre
      const parentCommit = await gh<{ tree: { sha: string } }>(
        this.token,
        `/repos/${plan.repo.fullName}/git/commits/${parentCommitSha}`
      )
      parentTreeSha = parentCommit.tree.sha
    } else {
      // Premier batch : récupérer le SHA du commit de base depuis la branche
      const baseBranchName = plan.branch.isNew ? plan.repo.defaultBranch : plan.branch.name
      const baseRef = await gh<{ object: { sha: string } }>(
        this.token,
        `/repos/${plan.repo.fullName}/git/ref/heads/${encodeBranchPath(baseBranchName)}`
      )
      const baseCommitSha = baseRef.object.sha
      const baseCommit = await gh<{ tree: { sha: string } }>(
        this.token,
        `/repos/${plan.repo.fullName}/git/commits/${baseCommitSha}`
      )
      parentTreeSha = baseCommit.tree.sha
      // Mettre à jour parentCommitSha pour l'utiliser dans le commit
      parentCommitSha = baseCommitSha
    }

    const treeEntries = items.map((i) => ({
      path: i.path,
      mode: '100644',
      type: 'blob',
      sha: this.blobCache.get(this.cacheKey(plan.repo, i.id)),
    }))

    const tree = await gh<{ sha: string }>(this.token, `/repos/${plan.repo.fullName}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: parentTreeSha, tree: treeEntries }),
    })
    steps[1].status = 'done'
    emitSteps()

    // Création du commit
    steps[2].status = 'uploading'
    emitSteps()
    const commit = await gh<{ sha: string }>(this.token, `/repos/${plan.repo.fullName}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: batchIndex > 0
          ? `${plan.commitMessage} (batch ${batchIndex + 1}/${totalBatches})`
          : plan.commitMessage,
        tree: tree.sha,
        parents: parentCommitSha ? [parentCommitSha] : [],
      }),
    })
    steps[2].status = 'done'
    emitSteps()

    return {
      commitSha: commit.sha,
      treeSha: tree.sha,
      baseSha: parentCommitSha,
      filesSent: items.length,
      filesFailed: 0,
    }
  }

  async commit(plan: CommitPlan, callbacks: CommitCallbacks, onlyItemIds?: string[]): Promise<SendResult> {
    const eligible = plan.files.filter((f) => !f.excluded)

    // Si onlyItemIds est spécifié, on ne traite que ces fichiers
    const filesToProcess = onlyItemIds
      ? eligible.filter(f => onlyItemIds.includes(f.id))
      : eligible

    // Vérifier si on a besoin de fractionner
    const needsBatching = filesToProcess.length > MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT ||
      filesToProcess.reduce((sum, f) => sum + f.size, 0) > MAX_RECOMMENDED_COMMIT_SIZE_BYTES

    // Déterminer le parent commit SHA pour le premier batch
    // On ne récupère pas baseSha ici pour éviter une requête fetch avant le upload
    // baseSha sera récupéré dans _commitSingleBatch si nécessaire

    if (!needsBatching) {
      // Cas simple : un seul commit suffit
      const result = await this._commitSingleBatch(
        plan,
        filesToProcess,
        null, // parentCommitSha sera déterminé depuis la branche
        callbacks,
        0,
        1
      )

      // Gérer la référence de branche
      const steps = START_STEPS.map((s) => ({ ...s }))
      const emitSteps = () => callbacks.onSteps(steps.map((s) => ({ ...s })))
      steps[3].status = 'uploading'
      emitSteps()

      const baseBranchName = plan.branch.isNew ? plan.repo.defaultBranch : plan.branch.name

      if (plan.branch.isNew) {
        await gh(this.token, `/repos/${plan.repo.fullName}/git/refs`, {
          method: 'POST',
          body: JSON.stringify({ ref: `refs/heads/${plan.branch.name}`, sha: result.commitSha }),
        })
      } else {
        await verifyAndPatchRef(this.token, plan.repo, plan.branch, result.baseSha, result.commitSha)
      }
      steps[3].status = 'done'
      emitSteps()

      return {
        commitSha: result.commitSha,
        commitUrl: `https://github.com/${plan.repo.fullName}/commit/${result.commitSha}`,
        filesSent: result.filesSent,
        filesFailed: result.filesFailed,
        batchCount: 1,
        currentBatch: 1,
        totalBatches: 1,
      }
    }

    // Cas avec fractionnement en plusieurs commits
    const batches = splitFilesIntoBatches(filesToProcess)
    const totalBatches = batches.length

    // Pour une branche existante avec batching, on doit utiliser une approche spéciale
    // pour éviter d'écraser l'historique : on crée les commits sur une branche temporaire
    // puis on squash tout en un seul commit sur la branche cible.
    // Pour une nouvelle branche, on peut créer directement les commits chaînés.
    const baseBranchName = plan.branch.isNew ? plan.repo.defaultBranch : plan.branch.name
    const baseRef = await gh<{ object: { sha: string } }>(
      this.token,
      `/repos/${plan.repo.fullName}/git/ref/heads/${encodeBranchPath(baseBranchName)}`
    )
    const baseSha = baseRef.object.sha

    // Pour une branche existante, créer une branche temporaire pour les commits batch
    const tempBranchName = plan.branch.isNew
      ? null
      : `treeporter-temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (tempBranchName) {
      // Créer la branche temporaire à partir du commit de base
      await gh(this.token, `/repos/${plan.repo.fullName}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${tempBranchName}`, sha: baseSha }),
      })
    }

    // Pour le premier batch, parentCommitSha est le SHA du commit de base
    // (ou null pour nouvelle branche, sera déterminé dans _commitSingleBatch)
    let currentParentSha: string | null = tempBranchName ? baseSha : null

    let totalFilesSent = 0
    let totalFilesFailed = 0
    let latestCommitSha = ''
    let latestTreeSha = ''

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Notifier la progression du batch
      if (callbacks.onBatchProgress) {
        callbacks.onBatchProgress(batchIndex + 1, totalBatches)
      }

      const batchResult = await this._commitSingleBatch(
        plan,
        batches[batchIndex],
        currentParentSha,
        callbacks,
        batchIndex,
        totalBatches
      )

      latestCommitSha = batchResult.commitSha
      latestTreeSha = batchResult.treeSha
      currentParentSha = batchResult.commitSha
      totalFilesSent += batchResult.filesSent
      totalFilesFailed += batchResult.filesFailed
    }

    // Mettre à jour la référence de branche
    const steps = START_STEPS.map((s) => ({ ...s }))
    const emitSteps = () => callbacks.onSteps(steps.map((s) => ({ ...s })))
    steps[3].status = 'uploading'
    emitSteps()

    if (plan.branch.isNew) {
      // Pour une nouvelle branche : pointer directement vers le dernier commit
      await gh(this.token, `/repos/${plan.repo.fullName}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${plan.branch.name}`, sha: latestCommitSha }),
      })
    } else {
      // Pour une branche existante : squash tous les commits en un seul
      // Créer un commit final avec l'arbre complet et comme parent le commit original
      const squashCommit = await gh<{ sha: string }>(this.token, `/repos/${plan.repo.fullName}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({
          message: plan.commitMessage,
          tree: latestTreeSha,
          parents: [baseSha],
        }),
      })

      // Vérifier que la branche cible n'a pas évolué avant d'écraser sa référence.
      // L'API GitHub ne propose pas de mise a jour conditionnelle (If-Match) sur
      // les references Git : il existe une petite fenetre de concurrence entre
      // cette verification et le PATCH. En cas de divergence, la branche est
      // preservee et une erreur 409 est levee.
      await verifyAndPatchRef(this.token, plan.repo, plan.branch, baseSha, squashCommit.sha)

      latestCommitSha = squashCommit.sha

      // Nettoyer : supprimer la branche temporaire
      try {
        await gh(this.token, `/repos/${plan.repo.fullName}/git/refs/heads/${encodeBranchPath(tempBranchName!)}`, {
          method: 'DELETE',
        })
      } catch {
        // Ignorer l'échec de suppression (la branche temp peut déjà être nettoyée)
      }
    }
    steps[3].status = 'done'
    emitSteps()

    return {
      commitSha: latestCommitSha,
      commitUrl: `https://github.com/${plan.repo.fullName}/commit/${latestCommitSha}`,
      filesSent: totalFilesSent,
      filesFailed: totalFilesFailed,
      batchCount: totalBatches,
      currentBatch: totalBatches,
      totalBatches: totalBatches,
    }
  }
}
