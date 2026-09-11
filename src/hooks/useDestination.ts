import { useState } from 'react'
import type { RefObject } from 'react'
import type { RepoRef, Destination } from '../types'
import type { GitProvider } from '../services/gitProvider'

const DEFAULT_DESTINATION: Destination = {
  repo: null,
  branch: null,
  targetPath: '',
  commitMessage: 'Ajout depuis iPhone (Treeport)',
}

// Sélection du dépôt/branche/chemin cible (écran Destination). Extrait de App.tsx (V2.0.0)
// sans changer le comportement. `onBranchChanged` permet au domaine "conflits" de se
// réinitialiser quand la branche cible change, sans que ce hook ait besoin de le connaître.
export function useDestination(providerRef: RefObject<GitProvider | null>, onBranchChanged: () => void) {
  const [repos, setRepos] = useState<RepoRef[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [destination, setDestination] = useState<Destination>(DEFAULT_DESTINATION)

  async function loadReposIfNeeded() {
    if (repos.length === 0 && providerRef.current) {
      setLoadingRepos(true)
      try {
        setRepos(await providerRef.current.listRepos())
      } finally {
        setLoadingRepos(false)
      }
    }
  }

  async function selectRepo(repo: RepoRef) {
    setDestination((d) => ({ ...d, repo, branch: null }))
    setBranches([])
    onBranchChanged()
    if (!providerRef.current) return
    setLoadingBranches(true)
    try {
      setBranches(await providerRef.current.listBranches(repo))
    } finally {
      setLoadingBranches(false)
    }
  }

  function updateDestination(partial: Partial<Destination>) {
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
  }

  function resetDestination() {
    setRepos([])
    setBranches([])
    setDestination(DEFAULT_DESTINATION)
  }

  /** Réinitialisation partielle utilisée après un envoi réussi ("Nouvel envoi") :
   *  on garde le dépôt/branche déjà choisis, seuls le chemin et le message repartent
   *  à leur valeur par défaut — comportement identique à l'ancien handleNewTransfer. */
  function resetDestinationKeepingTarget() {
    setDestination((d) => ({ ...DEFAULT_DESTINATION, repo: d.repo, branch: d.branch }))
  }

  return {
    repos,
    branches,
    loadingRepos,
    loadingBranches,
    destination,
    loadReposIfNeeded,
    selectRepo,
    updateDestination,
    markBranchCreated,
    resetDestination,
    resetDestinationKeepingTarget,
  }
}
