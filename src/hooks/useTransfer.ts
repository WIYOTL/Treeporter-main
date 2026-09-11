import { useState } from 'react'
import type { RefObject } from 'react'
import type { DockedFile, Destination, UploadStep, UploadItem, SendResult, ConflictResolution } from '../types'
import type { GitProvider } from '../services/gitProvider'
import { GitDockError } from '../services/gitProvider'
import { joinTargetPath, resolveRenamedPath } from '../services/fileTree'

// Envoi vers GitHub : progression, erreurs, retry ciblé, résultat final. Extrait de App.tsx
// (V2.0.0) sans changer le comportement.
export function useTransfer(providerRef: RefObject<GitProvider | null>) {
  const [steps, setSteps] = useState<UploadStep[]>([])
  const [items, setItems] = useState<UploadItem[]>([])
  const [incomplete, setIncomplete] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

  async function runCommit(
    destination: Destination,
    files: DockedFile[],
    conflictChoices: Map<string, ConflictResolution>,
    existingPaths: Set<string> | null,
    onlyItemIds?: string[]
  ): Promise<SendResult | null> {
    if (!providerRef.current || !destination.repo || !destination.branch) return null
    setFatalError(null)
    setIncomplete(false)

    // Applique les résolutions de conflits choisies par l'utilisateur : les fichiers "Ignorer"
    // sont retirés de l'envoi, les fichiers "Renommer" reçoivent un chemin alternatif libre.
    const filesForSend: DockedFile[] = []
    for (const f of files) {
      const choice = conflictChoices.get(f.id)
      if (choice === 'ignore') continue
      if (choice === 'rename' && existingPaths) {
        const original = joinTargetPath(destination.targetPath, f.relativePath)
        filesForSend.push({ ...f, renamedPath: resolveRenamedPath(original, existingPaths) })
      } else {
        filesForSend.push(f)
      }
    }

    try {
      const res = await providerRef.current.commit(
        {
          repo: destination.repo,
          branch: destination.branch,
          targetPath: destination.targetPath,
          commitMessage: destination.commitMessage,
          files: filesForSend,
        },
        { onSteps: setSteps, onItems: setItems },
        onlyItemIds
      )
      setResult(res)
      return res
    } catch (err) {
      if (err instanceof GitDockError && err.message === 'INCOMPLETE') {
        setIncomplete(true)
      } else {
        setFatalError(err instanceof Error ? err.message : "Échec de l'envoi.")
      }
      return null
    }
  }

  function handleRetry(
    destination: Destination,
    files: DockedFile[],
    conflictChoices: Map<string, ConflictResolution>,
    existingPaths: Set<string> | null
  ): Promise<SendResult | null> {
    const failedIds = items.filter((i) => i.status === 'error').map((i) => i.id)
    return runCommit(destination, files, conflictChoices, existingPaths, failedIds.length > 0 ? failedIds : undefined)
  }

  function resetTransfer() {
    setSteps([])
    setItems([])
    setIncomplete(false)
    setFatalError(null)
    setResult(null)
  }

  return {
    steps,
    items,
    incomplete,
    fatalError,
    result,
    runCommit,
    handleRetry,
    resetTransfer,
  }
}
