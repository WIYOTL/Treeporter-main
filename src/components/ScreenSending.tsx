import type { UploadItem, UploadStep } from '../types'
import { formatBytes } from '../services/fileTree'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  steps: UploadStep[]
  items: UploadItem[]
  incomplete: boolean
  fatalError: import('../i18n/message').MessageDescriptor | null
  onRetry: () => void
  onBackToPreview: () => void
  updatePending?: boolean
  currentBatch?: number
  totalBatches?: number
}

export function ScreenSending({
  steps,
  items,
  incomplete,
  fatalError,
  onRetry,
  onBackToPreview,
  updatePending,
  currentBatch = 1,
  totalBatches = 1,
}: Props) {
  const { locale, t, plural, formatMessage, formatNumber } = useI18n()
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorItems = items.filter((i) => i.status === 'error')
  const totalBytes = items.reduce((sum, i) => sum + i.size, 0)
  const sentBytes = items.reduce((sum, i) => sum + (i.status === 'done' ? i.size : i.bytesSent ?? 0), 0)
  const pct = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0

  return (
    <div>
      <div className="h1">{t('sending.title')}</div>
      <p className="p-dim">
        {t('sending.progress', { done: formatNumber(doneCount), total: formatNumber(items.length), percent: formatNumber(pct) })}
      </p>
      {totalBatches > 1 && (
        <p className="p-dim" style={{ fontSize: 14 }}>
          {t('sending.batchProgress', { current: formatNumber(currentBatch), total: formatNumber(totalBatches) })}
        </p>
      )}

      {updatePending && (
        <div className="banner banner-info" style={{ marginBottom: 12 }}>
          {t('sending.updateReady')}
        </div>
      )}

      <div className="progress-bar" style={{ marginBottom: 20 }}>
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        {steps.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
            <span className={`status-dot ${s.status}`} />
            <span style={{ fontSize: 13.5, color: s.status === 'done' ? 'var(--text-dim)' : 'var(--text)' }}>
              {t(s.label)}
            </span>
          </div>
        ))}
      </div>

      {fatalError && <div className="banner banner-error">{formatMessage(fatalError)}</div>}

      {incomplete && !fatalError && (
        <div className="banner banner-error">
          {plural('sending.incomplete.one', 'sending.incomplete.other', errorItems.length)}
        </div>
      )}

      <div className="section-label">{t('sending.fileDetails')}</div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px' }}>
            <span className={`status-dot ${item.status}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ticket-path">{item.path}</div>
              {item.error && <div className="ticket-meta" style={{ color: 'var(--red)' }}>{formatMessage(item.error)}</div>}
              {item.status === 'uploading' && item.size > 1024 * 1024 && (
                <div className="ticket-meta">
                  {formatBytes(item.bytesSent ?? 0, locale)} / {formatBytes(item.size, locale)}
                </div>
              )}
            </div>
            <div className="ticket-meta">{formatBytes(item.size, locale)}</div>
          </div>
        ))}
      </div>

      {(incomplete || fatalError) && (
        <div className="sticky-footer">
          <button className="btn btn-primary" onClick={onRetry}>
            {t('sending.retry')}
          </button>
          <button className="btn btn-ghost" onClick={onBackToPreview}>
            {t('sending.backToPreview')}
          </button>
        </div>
      )}
    </div>
  )
}
