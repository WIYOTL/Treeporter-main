import { useRef, useState } from 'react'
import type { DockedFile } from '../types'
import { TreeView } from './TreeView'
import { ActionSheet } from './ActionSheet'
import { formatBytes, totalSize } from '../services/fileTree'
import type { MessageDescriptor } from '../i18n/message'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  files: DockedFile[]
  onAdd: (fileList: FileList) => void
  onAddZip: (zipFile: File) => void
  onRemove: (id: string) => void
  onClear: () => void
  onContinue: () => void
  overwriteNotice: string[] | null
  onDismissOverwriteNotice: () => void
  zipLoading: boolean
  zipError: MessageDescriptor | null
  onDismissZipError: () => void
}

export function ScreenDock({
  files,
  onAdd,
  onAddZip,
  onRemove,
  onClear,
  onContinue,
  overwriteNotice,
  onDismissOverwriteNotice,
  zipLoading,
  zipError,
  onDismissZipError,
}: Props) {
  const { locale, t, plural, formatMessage, formatNumber } = useI18n()
  const [sheetOpen, setSheetOpen] = useState(false)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const includedCount = files.filter((f) => !f.excluded).length

  return (
    <div>
      <div className="h1">{t('dock.title')}</div>
      <p className="p-dim">{t('dock.instructions')}</p>

      {overwriteNotice && overwriteNotice.length > 0 && (
        <div className="banner banner-info" style={{ marginTop: 12 }}>
          {plural('dock.overwrite.one', 'dock.overwrite.other', overwriteNotice.length, {
            paths: '', count: formatNumber(overwriteNotice.length),
          })}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {overwriteNotice.slice(0, 3).join(', ')}
            {overwriteNotice.length > 3 ? `, +${formatNumber(overwriteNotice.length - 3)}` : ''}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={onDismissOverwriteNotice}>
            {t('common.understood')}
          </button>
        </div>
      )}

      {zipLoading && (
        <div className="banner banner-info" style={{ marginTop: 12 }}>
          {t('dock.extractingZip')}
        </div>
      )}

      {zipError && (
        <div className="banner banner-error" style={{ marginTop: 12 }}>
          {formatMessage(zipError)}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={onDismissZipError}>
            {t('common.understood')}
          </button>
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setSheetOpen(true)}>
        {t('dock.add')}
      </button>

      {/* input fichiers multiples */}
      <input
        ref={filesInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onAdd(e.target.files)
          e.target.value = ''
        }}
      />
      {/* input dossier complet (webkitdirectory) */}
      <input
        ref={dirInputRef}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: 'true', directory: 'true' } as any)}
        onChange={(e) => {
          if (e.target.files) onAdd(e.target.files)
          e.target.value = ''
        }}
      />
      {/* input archive .zip */}
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddZip(file)
          e.target.value = ''
        }}
      />

      {sheetOpen && (
        <ActionSheet
          title={t('dock.addQuestion')}
          onClose={() => setSheetOpen(false)}
          options={[
            { label: t('dock.files'), sub: t('dock.chooseFiles'), onSelect: () => filesInputRef.current?.click() },
            { label: t('dock.folder'), sub: t('dock.keepTree'), onSelect: () => dirInputRef.current?.click() },
            { label: t('dock.zip'), sub: t('dock.extractTree'), onSelect: () => zipInputRef.current?.click() },
          ]}
        />
      )}

      {files.length === 0 ? (
        <div className="empty-state">
          <div className="h1">{t('dock.emptyTitle')}</div>
          <p className="p-dim">{t('dock.emptyDescription')}</p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '18px 0 10px',
            }}
          >
            <div className="section-label" style={{ margin: 0 }}>
              {plural('dock.item.one', 'dock.item.other', includedCount)} · {formatBytes(totalSize(files), locale)}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClear}>
              {t('dock.clear')}
            </button>
          </div>
          <TreeView files={files} onRemove={onRemove} />
        </>
      )}

      <div className="sticky-footer">
        <button className="btn btn-primary" disabled={includedCount === 0} onClick={onContinue}>
          {plural('dock.continue.one', 'dock.continue.other', includedCount)}
        </button>
      </div>
    </div>
  )
}
