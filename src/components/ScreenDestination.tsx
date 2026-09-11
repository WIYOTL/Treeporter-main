import { useEffect, useState } from 'react'
import type { RepoRef, Destination } from '../types'
import { getTargetPathError } from '../services/fileTree'

interface Props {
  repos: RepoRef[]
  branches: string[]
  loadingRepos: boolean
  repositoryLoadError: string | null
  loadingBranches: boolean
  emptyRepo: boolean
  branchError: string | null
  destination: Destination
  onSelectRepo: (repo: RepoRef) => void
  loadRepos: () => Promise<void>
  onChange: (partial: Partial<Destination>) => void
  onBack: () => void
  onContinue: () => void
}

export function ScreenDestination({
  repos,
  branches,
  loadingRepos,
  repositoryLoadError,
  loadingBranches,
  emptyRepo,
  branchError,
  destination,
  onSelectRepo,
  loadRepos,
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
    } else {
      setNewBranchMode(false)
      setNewBranchName('')
    }
  }, [destination.branch])

  const filteredRepos = repos.filter((repo) =>
    repo.fullName.toLowerCase().includes(repoQuery.toLowerCase())
  )

  const targetPathError = getTargetPathError(
    destination.targetPath
  )

  const canContinue = Boolean(
    destination.repo &&
      destination.repo.canPush !== false &&
      destination.branch &&
      destination.branch.name.trim().length > 0 &&
      destination.commitMessage.trim() &&
      !emptyRepo &&
      !branchError &&
      !targetPathError
  )

  return (
    <div>
      <div className="h1">Destination</div>

      <p className="p-dim">
        Choisis le dépôt, la branche et l'emplacement cible.
      </p>

      <div className="section-label">Dépôt</div>

      {loadingRepos ? (
        <div className="p-dim">
          Chargement des dépôts…
        </div>
      ) : repositoryLoadError ? (
        <div
          className="banner banner-error"
          style={{ marginBottom: 12 }}
        >
          <div>
            Impossible de charger les dépôts.
          </div>

          <div>{repositoryLoadError}</div>

          <button
            className="btn btn-secondary btn-sm"
            style={{
              display: 'block',
              marginTop: 10,
            }}
            onClick={() => {
              void loadRepos()
            }}
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <div
            className="field"
            style={{ marginBottom: 10 }}
          >
            <input
              placeholder="Rechercher un dépôt…"
              value={repoQuery}
              onChange={(event) =>
                setRepoQuery(event.target.value)
              }
            />
          </div>

          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {filteredRepos.map((repo) => (
              <button
                key={repo.fullName}
                className={`select-row ${
                  destination.repo?.fullName === repo.fullName
                    ? 'is-selected'
                    : ''
                }`}
                style={{ width: '100%' }}
                onClick={() => {
                  onSelectRepo(repo)
                  setNewBranchMode(false)
                }}
              >
                <div>
                  <div className="select-row-title">
                    {repo.fullName}
                  </div>

                  <div className="select-row-sub">
                    branche par défaut : {repo.defaultBranch}
                    {repo.canPush === false
                      ? ' · ⚠️ lecture seule pour ce token'
                      : ''}
                  </div>
                </div>

                {destination.repo?.fullName === repo.fullName && (
                  <span>✓</span>
                )}
              </button>
            ))}

            {filteredRepos.length === 0 && (
              <div className="p-dim">
                Aucun dépôt trouvé.
              </div>
            )}
          </div>
        </>
      )}

      {destination.repo &&
        destination.repo.canPush === false && (
          <div
            className="banner banner-error"
            style={{ marginBottom: 12 }}
          >
            Ce token n'a pas les droits d'écriture sur{' '}
            <strong>{destination.repo.fullName}</strong> — impossible
            de continuer avec ce dépôt. Choisis-en un autre, ou
            utilise un token avec l'accès « Contents : Read and
            write » (ou le scope « repo » pour un token classique)
            sur celui-ci.
          </div>
        )}

      {destination.repo && (
        <>
          <div className="section-label">Branche</div>

          {loadingBranches ? (
            <div className="p-dim">
              Chargement des branches…
            </div>
          ) : emptyRepo ? (
            <div
              className="banner banner-info"
              style={{ marginBottom: 12 }}
            >
              Ce dépôt est vide : il ne possède encore aucune
              branche ni aucun commit. Initialise-le sur GitHub avec
              un premier commit, par exemple un README ou un autre
              fichier, puis recharge Treeporter.
            </div>
          ) : branchError ? (
            <div
              className="banner banner-error"
              style={{ marginBottom: 12 }}
            >
              Impossible de charger les branches de ce dépôt.{' '}
              {branchError}
            </div>
          ) : (
            <>
              {branches.map((branchName) => (
                <button
                  key={branchName}
                  className={`select-row ${
                    !newBranchMode &&
                    destination.branch?.name === branchName
                      ? 'is-selected'
                      : ''
                  }`}
                  style={{ width: '100%' }}
                  onClick={() => {
                    setNewBranchMode(false)
                    onChange({
                      branch: {
                        name: branchName,
                        isNew: false,
                      },
                    })
                  }}
                >
                  <div className="select-row-title">
                    {branchName}
                  </div>

                  {!newBranchMode &&
                    destination.branch?.name === branchName && (
                      <span>✓</span>
                    )}
                </button>
              ))}

              <button
                className={`select-row ${
                  newBranchMode ? 'is-selected' : ''
                }`}
                style={{ width: '100%' }}
                onClick={() => setNewBranchMode(true)}
              >
                <div className="select-row-title">
                  + Nouvelle branche
                </div>
              </button>

              {newBranchMode && (
                <div
                  className="field"
                  style={{ marginTop: 8 }}
                >
                  <input
                    placeholder="ex. depuis-iphone"
                    value={newBranchName}
                    onChange={(event) => {
                      const branchName = event.target.value

                      setNewBranchName(branchName)

                      onChange({
                        branch: {
                          name: branchName.trim(),
                          isNew: true,
                        },
                      })
                    }}
                  />

                  <div className="field-hint">
                    Créée depuis{' '}
                    {destination.repo.defaultBranch}.
                  </div>
                </div>
              )}
            </>
          )}

          <div className="section-label">
            Emplacement dans le dépôt
          </div>

          <div className="field">
            <input
              placeholder="dossier/optionnel (racine si vide)"
              value={destination.targetPath}
              onChange={(event) =>
                onChange({
                  targetPath: event.target.value,
                })
              }
            />

            <div className="field-hint">
              Les fichiers seront placés sous ce chemin,
              arborescence conservée.
            </div>

            {targetPathError && (
              <div
                className="field-hint"
                style={{ color: 'var(--red)' }}
              >
                Chemin cible invalide : {targetPathError}. Utilise
                un chemin relatif valide, par exemple
                « uploads/images », ou laisse le champ vide pour la
                racine.
              </div>
            )}
          </div>

          <div className="section-label">
            Message de commit
          </div>

          <div className="field">
            <textarea
              value={destination.commitMessage}
              onChange={(event) =>
                onChange({
                  commitMessage: event.target.value,
                })
              }
            />
          </div>
        </>
      )}

      <div className="sticky-footer">
        <button
          className="btn btn-primary"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Voir l'aperçu
        </button>

        <button
          className="btn btn-ghost"
          onClick={onBack}
        >
          ← Retour
        </button>
      </div>
    </div>
  )
}