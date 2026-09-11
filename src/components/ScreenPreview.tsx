import { useState } from 'react'
import type { DockedFile, Destination, ConflictResolution } from '../types'
import { formatBytes, totalSize, joinTargetPath, resolveRenamedPath } from '../services/fileTree'

interface Props {
  files: DockedFile[]
  destination: Destination
  onToggleExclude: (id: string) => void
  onBack: () => void
  onSend: () => void
  existingPaths: Set<string> | null
  conflictLoading: boolean
  conflictCheckError: string | null
  conflictChoices: Map<string, ConflictResolution>
  onSetConflictChoice: (fileId: string, resolution: ConflictResolution) => void
  onApplyBulkConflictChoice: (resolution: ConflictResolution) => void
}

const CHOICE_LABEL: Record<ConflictResolution, string> = {
  replace: 'Remplacer',
  ignore: 'Ignorer',
  rename: 'Renommer',
}

export function ScreenPreview({
  files,
  destination,
  onToggleExclude,
  onBack,
  onSend,
  existingPaths,
  conflictLoading,
  conflictCheckError,
  conflictChoices,
  onSetConflictChoice,
  onApplyBulkConflictChoice,
}: Props) {
  const [showExcluded, setShowExcluded] = useState(false)

  const originalPath = (f: DockedFile) => joinTargetPath(destination.targetPath, f.relativePath)
  const isIgnoredByConflict = (f: DockedFile) => conflictChoices.get(f.id) === 'ignore'
  const finalPath = (f: DockedFile) => {
    const original = originalPath(f)
    if (conflictChoices.get(f.id) === 'rename' && existingPaths) return resolveRenamedPath(original, existingPaths)
    return original
  }

  const excluded = files.filter((f) => f.excluded)
  const conflicting = files.filter((f) => !f.excluded && conflictChoices.has(f.id))
  const included = files.filter((f) => !f.excluded && !isIgnoredByConflict(f))
  const sendableSize = totalSize(included)

  return (
    <div>
      <div className="h1">Aperçu</div>
      <p className="p-dim">
        Vers <span className="mono-chip">{destination.repo?.fullName}</span> sur{' '}
        <span className="mono-chip">{destination.branch?.name}</span>
        {destination.branch?.isNew ? ' (nouvelle branche)' : ''}
      </p>

      {conflictLoading && (
        <div className="banner banner-info" style={{ marginTop: 12 }}>
          Vérification des fichiers déjà présents dans le dépôt…
        </div>
      )}

      {conflictCheckError && (
        <div className="banner banner-error" style={{ marginTop: 12 }}>
          {conflictCheckError}
        </div>
      )}

      {!conflictLoading && conflicting.length > 0 && (
        <>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 8px' }}
          >
            <div className="section-label" style={{ margin: 0 }}>
              {conflicting.length} conflit{conflicting.length > 1 ? 's' : ''} détecté{conflicting.length > 1 ? 's' : ''}
            </div>
          </div>
          <p className="p-dim" style={{ marginTop: 0 }}>
            Ces fichiers existent déjà à cet emplacement dans le dépôt. Choisis quoi faire pour chacun (ou pour tous).
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onApplyBulkConflictChoice('replace')}>
              Tout remplacer
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onApplyBulkConflictChoice('ignore')}>
              Tout ignorer
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onApplyBulkConflictChoice('rename')}>
              Tout renommer
            </button>
          </div>

          {conflicting.map((f) => {
            const choice = conflictChoices.get(f.id) ?? 'replace'
            return (
              <div key={f.id} className="card" style={{ marginBottom: 8 }}>
                <div className="ticket-path">{originalPath(f)}</div>
                {choice === 'rename' && existingPaths && (
                  <div className="ticket-meta" style={{ color: 'var(--teal)' }}>→ {finalPath(f)}</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {(['replace', 'ignore', 'rename'] as ConflictResolution[]).map((option) => (
                    <button
                      key={option}
                      className={`btn btn-sm ${choice === option ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => onSetConflictChoice(f.id, option)}
                    >
                      {CHOICE_LABEL[option]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="section-label">
        {included.length} fichier{included.length > 1 ? 's' : ''} à envoyer · {formatBytes(sendableSize)}
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {included.map((f) => (
          <div key={f.id} className="ticket">
            <div className="ticket-icon">📄</div>
            <div className="ticket-body">
              <div className="ticket-path">{finalPath(f)}</div>
              <div className="ticket-meta">
                {formatBytes(f.size)}
                {f.isLarge ? ' · ⚠️ volumineux, l\'envoi peut être lent' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {excluded.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setShowExcluded((s) => !s)}>
            {showExcluded ? 'Masquer' : 'Voir'} les {excluded.length} fichier{excluded.length > 1 ? 's' : ''} exclu
            {excluded.length > 1 ? 's' : ''}
          </button>
          {showExcluded && (
            <div style={{ marginTop: 8 }}>
              {excluded.map((f) => (
                <div key={f.id} className="ticket is-excluded">
                  <div className="ticket-icon">⛔</div>
                  <div className="ticket-body">
                    <div className="ticket-path">{f.relativePath}</div>
                    <div className="ticket-meta">{f.excludeReason}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => onToggleExclude(f.id)}>
                    Inclure
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="sticky-footer">
        <button className="btn btn-primary" disabled={included.length === 0} onClick={onSend}>
          Envoyer vers GitHub
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          ← Retour
        </button>
      </div>
    </div>
  )
}
