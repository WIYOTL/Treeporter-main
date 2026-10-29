import { useEffect, useState } from 'react'
import type { MessageDescriptor } from '../i18n/message'
import type { RepoRef, Destination } from '../types'
import { getTargetPathError } from '../services/fileTree'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  repos: RepoRef[]
  branches: string[]
  loadingRepos: boolean
  reposLoaded: boolean
  repositoryLoadError: MessageDescriptor | null
  loadingBranches: boolean
  emptyRepo: boolean
  branchError: MessageDescriptor | null
  destination: Destination
  onSelectRepo: (repo: RepoRef) => void
  loadRepos: () => Promise<void>
  onChange: (partial: Partial<Destination>) => void
  onBack: () => void
  onContinue: () => void
  onRetryBranches: () => void
}

export function ScreenDestination({
  repos,
  branches,
  loadingRepos,
  reposLoaded,
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
  onRetryBranches,
}: Props) {
  const { t, formatMessage } = useI18n()
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
      <div className="h1">{t('destination.title')}</div>

      <p className="p-dim">{t('destination.instructions')}</p>

      <div className="section-label">{t('destination.repository')}</div>

      {loadingRepos ? (
        <div className="p-dim">{t('destination.loadingRepositories')}</div>
      ) : repositoryLoadError ? (
        <div
          className="banner banner-error"
          style={{ marginBottom: 12 }}
        >
          <div>
            {t('destination.repositoryLoadFailed')}
          </div>

          {formatMessage(repositoryLoadError)}

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
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <>
          <div
            className="field"
            style={{ marginBottom: 10 }}
          >
            <input
              placeholder={t('destination.searchRepository')}
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
                    {t('destination.defaultBranch', { branch: repo.defaultBranch })}
                    {repo.canPush === false
                      ? t('destination.readOnly')
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
                {repoQuery.length > 0
                  ? t('destination.noSearchResults')
                  : t('destination.noRepositories')}
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
            {t('destination.noWriteAccess', { repository: destination.repo.fullName })}
          </div>
        )}

      {destination.repo && (
        <>
          <div className="section-label">{t('destination.branch')}</div>

          {loadingBranches ? (
            <div className="p-dim">{t('destination.loadingBranches')}</div>
          ) : emptyRepo ? (
            <div
              className="banner banner-info"
              style={{ marginBottom: 12 }}
            >
              {t('destination.emptyRepository')}
            </div>
          ) : branchError ? (
            <div
              className="banner banner-error"
              style={{ marginBottom: 12 }}
            >
              {t('destination.branchLoadFailed')}{' '}
              {formatMessage(branchError)}
              <button
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'block',
                  marginTop: 10,
                }}
                onClick={() => {
                  void onRetryBranches()
                }}
              >
                {t('common.retry')}
              </button>
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
                  {t('destination.newBranch')}
                </div>
              </button>

              {newBranchMode && (
                <div
                  className="field"
                  style={{ marginTop: 8 }}
                >
                  <input
                    placeholder={t('destination.newBranchPlaceholder')}
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
                    {t('destination.branchCreatedFrom', { branch: destination.repo.defaultBranch })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="section-label">
            {t('destination.targetPath')}
          </div>

          <div className="field">
            <input
              placeholder={t('destination.targetPathPlaceholder')}
              value={destination.targetPath}
              onChange={(event) =>
                onChange({
                  targetPath: event.target.value,
                })
              }
            />

            <div className="field-hint">
              {t('destination.targetPathHint')}
            </div>

            {targetPathError && (
              <div
                className="field-hint"
                style={{ color: 'var(--red)' }}
              >
                {t('destination.invalidTargetPath', { reason: targetPathError })}
              </div>
            )}
          </div>

          <div className="section-label">
            {t('destination.commitMessage')}
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
          {t('destination.preview')}
        </button>

        <button
          className="btn btn-ghost"
          onClick={onBack}
        >
          {t('common.back')}
        </button>
      </div>
    </div>
  )
}
