import type { SendResult, Destination } from '../types'
import type { HistoryEntry } from '../services/history'
import type { MessageDescriptor } from '../i18n/message'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  result: SendResult
  destination: Destination
  demo: boolean
  onNewTransfer: () => void
  previousHistory: HistoryEntry[]
  onCreatePullRequest: () => void
  prLoading: boolean
  prError: MessageDescriptor | null
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
  const { t, plural, formatMessage, formatDate } = useI18n()
  return (
    <div
      style={{
        textAlign: 'center',
        paddingTop: 20,
      }}
    >
      <div className="result-badge">✓</div>

      <div className="h1">{t('result.commitCreated')}</div>

      <p className="p-dim">
        {plural('result.filesSent.one', 'result.filesSent.other', result.filesSent, {
          repository: destination.repo?.fullName ?? '', branch: destination.branch?.name ?? '',
        })}
      </p>

      <div
        className="card"
        style={{
          textAlign: 'left',
          margin: '20px 0',
        }}
      >
        <div className="ticket-meta">{t('result.commitSha')}</div>

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
          {t('result.demoCommit')}
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
          {t('result.viewCommit')}
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
            ? t('result.createPullRequestLoading')
            : t('result.createPullRequest')}
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
          {formatMessage(prError)}
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
          {t('result.viewPullRequest')}
        </a>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={onNewTransfer}
      >
        {t('result.newTransfer')}
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
            {t('result.previousTransfers')}
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
                    {t('result.branch')}{' '}
                    <span className="mono-chip">
                      {entry.branchName}
                    </span>
                  </div>

                  <div className="history-entry-meta">
                    <span>
                      {plural('common.count.file.one', 'common.count.file.other', entry.filesSent)}
                    </span>

                    <span>
                      {formatDate(entry.at)}
                    </span>

                    {entry.demo && (
                      <span className="demo-badge">
                        {t('result.demo')}
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
                    {t('result.commitLink')}
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
