import type { UploadItem, UploadStep } from '../types'
import { formatBytes } from '../services/fileTree'

interface Props {
  steps: UploadStep[]
  items: UploadItem[]
  incomplete: boolean
  fatalError: string | null
  onRetry: () => void
  onBackToPreview: () => void
  updatePending?: boolean
}

export function ScreenSending({
  steps,
  items,
  incomplete,
  fatalError,
  onRetry,
  onBackToPreview,
  updatePending,
}: Props) {
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorItems = items.filter((i) => i.status === 'error')
  const totalBytes = items.reduce((sum, i) => sum + i.size, 0)
  const sentBytes = items.reduce((sum, i) => sum + (i.status === 'done' ? i.size : i.bytesSent ?? 0), 0)
  const pct = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0

  return (
    <div>
      <div className="h1">Envoi en cours</div>
      <p className="p-dim">
        {doneCount} / {items.length} fichiers · {pct}%
      </p>

      {updatePending && (
        <div className="banner banner-info" style={{ marginBottom: 12 }}>
          Une nouvelle version de Treeport est disponible — elle s'appliquera automatiquement juste après cet envoi.
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
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {fatalError && <div className="banner banner-error">{fatalError}</div>}

      {incomplete && !fatalError && (
        <div className="banner banner-error">
          {errorItems.length} fichier{errorItems.length > 1 ? 's' : ''} n'ont pas pu être envoyés. Aucun commit n'a
          été créé — réessaie pour compléter l'envoi.
        </div>
      )}

      <div className="section-label">Détail par fichier</div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px' }}>
            <span className={`status-dot ${item.status}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ticket-path">{item.path}</div>
              {item.error && <div className="ticket-meta" style={{ color: 'var(--red)' }}>{item.error}</div>}
              {item.status === 'uploading' && item.size > 1024 * 1024 && (
                <div className="ticket-meta">
                  {formatBytes(item.bytesSent ?? 0)} / {formatBytes(item.size)}
                </div>
              )}
            </div>
            <div className="ticket-meta">{formatBytes(item.size)}</div>
          </div>
        ))}
      </div>

      {(incomplete || fatalError) && (
        <div className="sticky-footer">
          <button className="btn btn-primary" onClick={onRetry}>
            Réessayer
          </button>
          <button className="btn btn-ghost" onClick={onBackToPreview}>
            ← Revenir à l'aperçu
          </button>
        </div>
      )}
    </div>
  )
}
