import type { SendResult, Destination } from '../types'
import type { HistoryEntry } from '../services/history'

interface Props {
  result: SendResult
  destination: Destination
  demo: boolean
  onNewTransfer: () => void
  previousHistory: HistoryEntry[]
  onCreatePullRequest: () => void
  prLoading: boolean
  prError: string | null
  prUrl: string | null
  branchWasCreated: boolean
}

export function ScreenResult({
  result,
  destination,
  demo,
  onNewTransfer,
  previousHistory,
  onCreatePullRequest,
  prLoading,
  prError,
  prUrl,
  branchWasCreated,
}: Props) {
  return (
    <div
      style={{
        textAlign: 'center',
        paddingTop: 20,
      }}
    >
      <div className="result-badge">✓</div>

      <div className="h1">Commit créé</div>

      <p className="p-dim">
        {result.filesSent} fichier
        {result.filesSent > 1 ? 's' : ''} envoyé
        {result.filesSent > 1 ? 's' : ''} vers{' '}
        <span className="mono-chip">
          {destination.repo?.fullName}
        </span>{' '}
        ({destination.branch?.name})
      </p>

      <div
        className="card"
        style={{
          textAlign: 'left',
          margin: '20px 0',
        }}
      >
        <div className="ticket-meta">SHA du commit</div>

        <div
          className="ticket-path"
          style={{
            fontSize: 13.5,
            marginTop: 2,
          }}
        >
          {result.commitSha}
        </div>
      </div>

      {demo && (
        <div
          className="banner banner-info"
          style={{
            textAlign: 'left',
            marginBottom: 16,
          }}
        >
          Mode démo : ce commit est simulé, rien n'a été envoyé
          sur GitHub.
        </div>
      )}

      {!demo && (
        <a
          href={result.commitUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{ marginBottom: 10 }}
        >
          Voir le commit sur GitHub
        </a>
      )}

      {branchWasCreated && !prUrl && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginBottom: 10 }}
          onClick={onCreatePullRequest}
          disabled={prLoading}
        >
          {prLoading
            ? 'Création de la Pull Request…'
            : 'Créer une Pull Request'}
        </button>
      )}

      {prError && (
        <div
          className="banner banner-error"
          style={{
            textAlign: 'left',
            marginBottom: 10,
          }}
        >
          {prError}
        </div>
      )}

      {prUrl && (
        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary"
          style={{ marginBottom: 10 }}
        >
          Voir la Pull Request
        </a>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={onNewTransfer}
      >
        Nouvel envoi
      </button>

      {previousHistory.length > 0 && (
        <>
          <div
            className="section-label"
            style={{
              textAlign: 'left',
              marginTop: 24,
            }}
          >
            Envois précédents
          </div>

          <div style={{ textAlign: 'left' }}>
            {previousHistory.map((entry) => (
              <div
                key={entry.id}
                className="history-entry"
              >
                <div className="history-entry-main">
                  <div className="history-entry-repo">
                    {entry.repoFullName}
                  </div>

                  <div className="history-entry-branch">
                    branche{' '}
                    <span className="mono-chip">
                      {entry.branchName}
                    </span>
                  </div>

                  <div className="history-entry-meta">
                    <span>
                      {entry.filesSent} fichier
                      {entry.filesSent > 1 ? 's' : ''}
                    </span>

                    <span>
                      {new Date(entry.at).toLocaleString('fr-FR')}
                    </span>

                    {entry.demo && (
                      <span className="demo-badge">
                        Démo
                      </span>
                    )}
                  </div>
                </div>

                {!entry.demo && entry.commitUrl && (
                  <a
                    href={entry.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Commit
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}