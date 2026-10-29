import { useState } from 'react'
import type { DockedFile, Destination, ConflictResolution } from '../types'
import { formatBytes, totalSize, joinTargetPath, resolveRenamedPath } from '../services/fileTree'
import type { MessageKey } from '../i18n/messages'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageDescriptor } from '../i18n/message'

interface Props {
  files: DockedFile[]
  destination: Destination
  onToggleExclude: (id: string) => void
  onBack: () => void
  onSend: () => void
  existingPaths: Set<string> | null
  conflictLoading: boolean
  conflictCheckError: MessageDescriptor | null
  conflictChoices: Map<string, ConflictResolution>
  onSetConflictChoice: (fileId: string, resolution: ConflictResolution) => void
  onApplyBulkConflictChoice: (resolution: ConflictResolution) => void
}

const CHOICE_LABEL: Record<ConflictResolution, MessageKey> = {
  replace: 'preview.replace',
  ignore: 'preview.ignore',
  rename: 'preview.rename',
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
  const { locale, t, plural, formatMessage } = useI18n()
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
      <div className="h1">{t('preview.title')}</div>
      <p className="p-dim">
        {t('preview.destination', { repository: destination.repo?.fullName ?? '', branch: destination.branch?.name ?? '' })}
        {destination.branch?.isNew ? ` ${t('preview.newBranch')}` : ''}
      </p>

      {conflictLoading && (
        <div className="banner banner-info" style={{ marginTop: 12 }}>
          {t('preview.checkingConflicts')}
        </div>
      )}

      {conflictCheckError && (
        <div className="banner banner-error" style={{ marginTop: 12 }}>
          {formatMessage(conflictCheckError)}
        </div>
      )}

      {!conflictLoading && conflicting.length > 0 && (
        <>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 8px' }}
          >
            <div className="section-label" style={{ margin: 0 }}>
              {plural('preview.conflict.one', 'preview.conflict.other', conflicting.length)}
            </div>
          </div>
          <p className="p-dim" style={{ marginTop: 0 }}>
            {t('preview.conflictInstructions')}
          </p>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onApplyBulkConflictChoice('replace')}>
              {t('preview.replaceAll')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onApplyBulkConflictChoice('ignore')}>
              {t('preview.ignoreAll')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onApplyBulkConflictChoice('rename')}>
              {t('preview.renameAll')}
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
                      {t(CHOICE_LABEL[option])}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="section-label">
        {plural('preview.file.one', 'preview.file.other', included.length, { size: formatBytes(sendableSize, locale) })}
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {included.map((f) => (
          <div key={f.id} className="ticket">
            <div className="ticket-icon">📄</div>
            <div className="ticket-body">
              <div className="ticket-path">{finalPath(f)}</div>
              <div className="ticket-meta">
                {formatBytes(f.size, locale)}
                {f.isLarge ? t('preview.largeFile') : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {excluded.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setShowExcluded((s) => !s)}>
            {t(showExcluded ? 'preview.hide' : 'preview.show')} {plural('preview.excluded.one', 'preview.excluded.other', excluded.length)}
          </button>
          {showExcluded && (
            <div style={{ marginTop: 8 }}>
              {excluded.map((f) => (
                <div key={f.id} className="ticket is-excluded">
                  <div className="ticket-icon">⛔</div>
                  <div className="ticket-body">
                    <div className="ticket-path">{f.relativePath}</div>
                    <div className="ticket-meta">{f.excludeReason ? t(f.excludeReason) : ''}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => onToggleExclude(f.id)}>
                    {t('preview.include')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="sticky-footer">
        <button className="btn btn-primary" disabled={included.length === 0} onClick={onSend}>
          {t('preview.send')}
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    </div>
  )
}
