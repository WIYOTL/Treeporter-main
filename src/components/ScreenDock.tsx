import { useRef, useState } from 'react'
import type { DockedFile } from '../types'
import { TreeView } from './TreeView'
import { ActionSheet } from './ActionSheet'
import { formatBytes, totalSize } from '../services/fileTree'

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
  zipError: string | null
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const includedCount = files.filter((f) => !f.excluded).length

  return (
    <div>
      <div className="h1">Zone de transfert</div>
      <p className="p-dim">Ajoute des fichiers, un dossier complet, ou une archive .zip depuis l'app Fichiers.</p>

      {overwriteNotice && overwriteNotice.length > 0 && (
        <div className="banner banner-info" style={{ marginTop: 12 }}>
          {overwriteNotice.length} fichier{overwriteNotice.length > 1 ? 's' : ''} déjà présent
          {overwriteNotice.length > 1 ? 's ont' : ' a'} été remplacé{overwriteNotice.length > 1 ? 's' : ''} par ce
          nouvel ajout (même chemin) :{' '}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {overwriteNotice.slice(0, 3).join(', ')}
            {overwriteNotice.length > 3 ? `, +${overwriteNotice.length - 3}` : ''}
          </span>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={onDismissOverwriteNotice}>
            Compris
          </button>
        </div>
      )}

      {zipLoading && (
        <div className="banner banner-info" style={{ marginTop: 12 }}>
          Extraction de l'archive…
        </div>
      )}

      {zipError && (
        <div className="banner banner-error" style={{ marginTop: 12 }}>
          {zipError}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={onDismissZipError}>
            Compris
          </button>
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setSheetOpen(true)}>
        + Ajouter
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
          title="Que veux-tu ajouter ?"
          onClose={() => setSheetOpen(false)}
          options={[
            { label: 'Fichiers', sub: 'Choisir un ou plusieurs fichiers', onSelect: () => filesInputRef.current?.click() },
            { label: 'Dossier complet', sub: "Conserve toute l'arborescence", onSelect: () => dirInputRef.current?.click() },
            { label: 'Archive .zip', sub: "Extrait l'arborescence de l'archive", onSelect: () => zipInputRef.current?.click() },
          ]}
        />
      )}

      {files.length === 0 ? (
        <div className="empty-state">
          <div className="h1">Rien pour l'instant</div>
          <p className="p-dim">Appuie sur « + Ajouter » pour choisir des fichiers ou un dossier depuis Fichiers.</p>
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
              {includedCount} élément{includedCount > 1 ? 's' : ''} · {formatBytes(totalSize(files))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClear}>
              Tout vider
            </button>
          </div>
          <TreeView files={files} onRemove={onRemove} />
        </>
      )}

      <div className="sticky-footer">
        <button className="btn btn-primary" disabled={includedCount === 0} onClick={onContinue}>
          Continuer · {includedCount} fichier{includedCount > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
