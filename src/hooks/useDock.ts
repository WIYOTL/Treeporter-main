import { useState } from 'react'
import type { DockedFile } from '../types'
import { filesToDocked, mergeDocked } from '../services/fileTree'
import { zipToDocked } from '../services/zip'
import { messageFromError } from '../i18n/message'
import type { MessageDescriptor } from '../i18n/message'
import { useI18n } from '../i18n/I18nProvider'

// Fichiers/dossiers ajoutés dans la "zone de transfert" (écran Dock). Extrait de App.tsx
// (V2.0.0) sans changer le comportement.
export function useDock() {
  const { t, formatNumber } = useI18n()
  const [files, setFiles] = useState<DockedFile[]>([])
  const [overwriteNotice, setOverwriteNotice] = useState<string[] | null>(null)
  const [zipLoading, setZipLoading] = useState(false)
  const [zipError, setZipError] = useState<MessageDescriptor | null>(null)

  function mergeAndNotify(added: DockedFile[]) {
    setFiles((prev) => {
      const { files: merged, overwritten } = mergeDocked(prev, added)
      setOverwriteNotice(overwritten.length > 0 ? overwritten : null)
      return merged
    })
  }

  function handleAdd(fileList: FileList) {
    mergeAndNotify(filesToDocked(fileList))
  }

  async function handleAddZip(zipFile: File) {
    setZipLoading(true)
    setZipError(null)
    try {
      const extracted = await zipToDocked(zipFile)
      mergeAndNotify(extracted)
    } catch (err) {
      setZipError(messageFromError(err, 'errors.zipRead'))
    } finally {
      setZipLoading(false)
    }
  }

  function handleRemove(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function handleToggleExclude(id: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, excluded: !f.excluded } : f)))
  }

  function handleClearWithConfirm() {
    if (files.length === 0 || window.confirm(t('dock.clearConfirm', { count: formatNumber(files.length) }))) {
      setFiles([])
      setOverwriteNotice(null)
    }
  }

  function dismissOverwriteNotice() {
    setOverwriteNotice(null)
  }

  function dismissZipError() {
    setZipError(null)
  }

  function resetDock() {
    setFiles([])
    setOverwriteNotice(null)
    setZipLoading(false)
    setZipError(null)
  }

  return {
    files,
    overwriteNotice,
    zipLoading,
    zipError,
    handleAdd,
    handleAddZip,
    handleRemove,
    handleToggleExclude,
    handleClearWithConfirm,
    dismissOverwriteNotice,
    dismissZipError,
    resetDock,
  }
}
