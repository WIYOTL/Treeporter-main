import { useEffect, useState } from 'react'
import type { RepoRef, Destination } from '../types'

interface Props {
  repos: RepoRef[]
  branches: string[]
  loadingRepos: boolean
  loadingBranches: boolean
  destination: Destination
  onSelectRepo: (repo: RepoRef) => void
  onChange: (partial: Partial<Destination>) => void
  onBack: () => void
  onContinue: () => void
}

export function ScreenDestination({
  repos,
  branches,
  loadingRepos,
  loadingBranches,
  destination,
  onSelectRepo,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const [repoQuery, setRepoQuery] = useState('')
  const [newBranchMode, setNewBranchMode] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  useEffect(() => {
    if (destination.branch?.isNew) {
      setNewBranchMode(true)
      setNewBranchName(destination.branch.name)
    }
  }, [destination.repo])

  const filteredRepos = repos.filter((r) => r.fullName.toLowerCase().includes(repoQuery.toLowerCase()))

  const canContinue = Boolean(
    destination.repo &&
      destination.repo.canPush !== false &&
      destination.branch &&
      destination.branch.name.trim().length > 0 &&
      destination.commitMessage.trim()
  )

  return (
    <div>
      <div className="h1">Destination</div>
      <p className="p-dim">Choisis le dépôt, la branche et l'emplacement cible.</p>

      <div className="section-label">Dépôt</div>
      {loadingRepos ? (
        <div className="p-dim">Chargement des dépôts…</div>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 10 }}>
            <input placeholder="Rechercher un dépôt…" value={repoQuery} onChange={(e) => setRepoQuery(e.target.value)} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filteredRepos.map((repo) => (
              <button
                key={repo.fullName}
                className={`select-row ${destination.repo?.fullName === repo.fullName ? 'is-selected' : ''}`}
                style={{ width: '100%' }}
                onClick={() => {
                  onSelectRepo(repo)
                  setNewBranchMode(false)
                }}
              >
                <div>
                  <div className="select-row-title">{repo.fullName}</div>
                  <div className="select-row-sub">
                    branche par défaut : {repo.defaultBranch}
                    {repo.canPush === false ? ' · ⚠️ lecture seule pour ce token' : ''}
                  </div>
                </div>
                {destination.repo?.fullName === repo.fullName && <span>✓</span>}
              </button>
            ))}
            {filteredRepos.length === 0 && <div className="p-dim">Aucun dépôt trouvé.</div>}
          </div>
        </>
      )}

      {destination.repo && destination.repo.canPush === false && (
        <div className="banner banner-error" style={{ marginBottom: 12 }}>
          Ce token n'a pas les droits d'écriture sur <strong>{destination.repo.fullName}</strong> — impossible de
          continuer avec ce dépôt. Choisis-en un autre, ou utilise un token avec l'accès « Contents : Read and
          write » (ou le scope « repo » pour un token classique) sur celui-ci.
        </div>
      )}

      {destination.repo && (
        <>
          <div className="section-label">Branche</div>
          {loadingBranches ? (
            <div className="p-dim">Chargement des branches…</div>
          ) : (
            <>
              {branches.map((b) => (
                <button
                  key={b}
                  className={`select-row ${!newBranchMode && destination.branch?.name === b ? 'is-selected' : ''}`}
                  style={{ width: '100%' }}
                  onClick={() => {
                    setNewBranchMode(false)
                    onChange({ branch: { name: b, isNew: false } })
                  }}
                >
                  <div className="select-row-title">{b}</div>
                  {!newBranchMode && destination.branch?.name === b && <span>✓</span>}
                </button>
              ))}
              <button
                className={`select-row ${newBranchMode ? 'is-selected' : ''}`}
                style={{ width: '100%' }}
                onClick={() => setNewBranchMode(true)}
              >
                <div className="select-row-title">+ Nouvelle branche</div>
              </button>
              {newBranchMode && (
                <div className="field" style={{ marginTop: 8 }}>
                  <input
                    placeholder="ex. depuis-iphone"
                    value={newBranchName}
                    onChange={(e) => {
                      setNewBranchName(e.target.value)
                      // Le champ affiche ce que l'utilisateur tape tel quel, mais la valeur propagée
                      // (utilisée pour la validation et l'appel API) est nettoyée des espaces —
                      // un nom de branche Git ne peut pas en contenir.
                      onChange({ branch: { name: e.target.value.trim(), isNew: true } })
                    }}
                  />
                  <div className="field-hint">Créée depuis {destination.repo.defaultBranch}.</div>
                </div>
              )}
            </>
          )}

          <div className="section-label">Emplacement dans le dépôt</div>
          <div className="field">
            <input
              placeholder="dossier/optionnel (racine si vide)"
              value={destination.targetPath}
              onChange={(e) => onChange({ targetPath: e.target.value })}
            />
            <div className="field-hint">Les fichiers seront placés sous ce chemin, arborescence conservée.</div>
          </div>

          <div className="section-label">Message de commit</div>
          <div className="field">
            <textarea
              value={destination.commitMessage}
              onChange={(e) => onChange({ commitMessage: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="sticky-footer">
        <button className="btn btn-primary" disabled={!canContinue} onClick={onContinue}>
          Voir l'aperçu
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          ← Retour
        </button>
      </div>
    </div>
  )
}
