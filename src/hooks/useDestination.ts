import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { RepoRef, Destination } from '../types'
import type { GitProvider } from '../services/gitProvider'
import { messageFromError } from '../i18n/message'
import type { MessageDescriptor } from '../i18n/message'
import { useI18n } from '../i18n/I18nProvider'
import { messages } from '../i18n/messages'
import type { Locale } from '../i18n/messages'

function defaultDestination(locale: Locale): Destination {
  return {
    repo: null,
    branch: null,
    targetPath: '',
    commitMessage: messages[locale]['destination.defaultCommitMessage'],
  }
}

// Sélection du dépôt/branche/chemin cible (écran Destination). Extrait de App.tsx (V2.0.0)
// sans changer le comportement. `onBranchChanged` permet au domaine "conflits" de se
// réinitialiser quand la branche cible change, sans que ce hook ait besoin de le connaître.
export function useDestination(providerRef: RefObject<GitProvider | null>, onBranchChanged: () => void) {
  const { locale } = useI18n()
  const previousLocale = useRef(locale)
  const [repos, setRepos] = useState<RepoRef[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [reposLoaded, setReposLoaded] = useState(false)
  const [branchesLoaded, setBranchesLoaded] = useState(false)
  const [repositoryLoadError, setRepositoryLoadError] = useState<MessageDescriptor | null>(null)
  const [branchLoadError, setBranchLoadError] = useState<MessageDescriptor | null>(null)
  const [destination, setDestination] = useState<Destination>(() => defaultDestination(locale))
  const commitMessageCustomized = useRef(false)
  const repoLoadRequest = useRef(0)
  const branchLoadRequest = useRef(0)
  const repoLoadInProgress = useRef(false)
  const reposLoadedRef = useRef(false)

  useEffect(() => {
    const previous = previousLocale.current
    if (previous !== locale) {
      const nextDefault = messages[locale]['destination.defaultCommitMessage']
      if (!commitMessageCustomized.current) {
        setDestination((current) => ({ ...current, commitMessage: nextDefault }))
      }
      previousLocale.current = locale
    }
  }, [locale])

  async function loadReposIfNeeded() {
    if (reposLoadedRef.current || repoLoadInProgress.current) return

    const provider = providerRef.current
    if (!provider) {
      setRepositoryLoadError({ key: 'errors.githubUnavailable' })
      return
    }

    const requestId = ++repoLoadRequest.current
    repoLoadInProgress.current = true
    setLoadingRepos(true)
    setRepositoryLoadError(null)

    try {
      const loadedRepos = await provider.listRepos()
      if (requestId !== repoLoadRequest.current) return
      setRepos(loadedRepos)
      reposLoadedRef.current = true
      setReposLoaded(true)
    } catch (err) {
      if (requestId === repoLoadRequest.current) {
        setRepositoryLoadError(messageFromError(err, 'errors.repositoryLoad'))
      }
    } finally {
      if (requestId === repoLoadRequest.current) {
        repoLoadInProgress.current = false
        setLoadingRepos(false)
      }
    }
  }

  async function loadBranches(repo: RepoRef) {
    const requestId = ++branchLoadRequest.current
    setBranches([])
    setBranchesLoaded(false)
    setBranchLoadError(null)
    setLoadingBranches(false)

    const provider = providerRef.current
    if (!provider) {
      setBranchLoadError({ key: 'errors.githubUnavailable' })
      return
    }

    setLoadingBranches(true)
    try {
      const loadedBranches = await provider.listBranches(repo)
      if (requestId !== branchLoadRequest.current) return
      setBranches(loadedBranches)
      setBranchesLoaded(true)
    } catch (err) {
      if (requestId === branchLoadRequest.current) {
        setBranchLoadError(messageFromError(err, 'errors.branchLoad'))
      }
    } finally {
      if (requestId === branchLoadRequest.current) setLoadingBranches(false)
    }
  }

  async function selectRepo(repo: RepoRef) {
    setDestination((d) => ({ ...d, repo, branch: null }))
    setBranches([])
    setBranchesLoaded(false)
    setRepositoryLoadError(null)
    setBranchLoadError(null)
    onBranchChanged()
    await loadBranches(repo)
  }

  async function retryBranches() {
    if (destination.repo) await loadBranches(destination.repo)
  }

  function updateDestination(partial: Partial<Destination>) {
    if (Object.prototype.hasOwnProperty.call(partial, 'commitMessage')) {
      commitMessageCustomized.current = true
    }
    if (partial.branch) onBranchChanged()
    setDestination((d) => ({ ...d, ...partial }))
  }

  /** À appeler juste après un envoi réussi qui a créé une nouvelle branche : la branche
   *  existe désormais réellement sur GitHub, donc les envois suivants (ex. "Nouvel envoi"
   *  sans revenir sur l'écran Destination) doivent la traiter comme une branche existante,
   *  pas la recréer. Ne déclenche pas onBranchChanged : l'identité de la branche ne change
   *  pas, seul son statut "nouvelle" devient obsolète — pas besoin de rouvrir les conflits.
   *  Ajoute aussi la branche à la liste locale `branches`, sans refaire d'appel réseau
   *  (son nom est déjà connu) — sinon elle resterait absente de la liste affichée si
   *  l'utilisateur revient sur l'écran Destination pour un second envoi. */
  function markBranchCreated() {
    const name = destination.branch?.name
    if (!name) return
    setDestination((d) => (d.branch ? { ...d, branch: { ...d.branch, isNew: false } } : d))
    setBranches((prevBranches) => (prevBranches.includes(name) ? prevBranches : [...prevBranches, name]))
    setBranchesLoaded(true)
  }

  function resetDestination() {
    repoLoadRequest.current += 1
    branchLoadRequest.current += 1
    repoLoadInProgress.current = false
    reposLoadedRef.current = false
    setRepos([])
    setBranches([])
    setLoadingRepos(false)
    setLoadingBranches(false)
    setReposLoaded(false)
    setBranchesLoaded(false)
    setRepositoryLoadError(null)
    setBranchLoadError(null)
    commitMessageCustomized.current = false
    setDestination(defaultDestination(locale))
  }

  /** Réinitialisation partielle utilisée après un envoi réussi ("Nouvel envoi") :
   *  on garde le dépôt/branche déjà choisis, seuls le chemin et le message repartent
   *  à leur valeur par défaut — comportement identique à l'ancien handleNewTransfer. */
  function resetDestinationKeepingTarget() {
    branchLoadRequest.current += 1
    setLoadingBranches(false)
    setRepositoryLoadError(null)
    setBranchLoadError(null)
    commitMessageCustomized.current = false
    setDestination((d) => ({ ...defaultDestination(locale), repo: d.repo, branch: d.branch }))
  }

  return {
    repos,
    branches,
    loadingRepos,
    loadingBranches,
    reposLoaded,
    branchesLoaded,
    repositoryLoadError,
    branchLoadError,
    destination,
    loadReposIfNeeded,
    selectRepo,
    retryBranches,
    updateDestination,
    markBranchCreated,
    resetDestination,
    resetDestinationKeepingTarget,
  }
}
