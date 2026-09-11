import { useState } from 'react'
import type { RefObject } from 'react'
import type { DockedFile, Destination, ConflictResolution } from '../types'
import type { GitProvider } from '../services/gitProvider'
import { joinTargetPath } from '../services/fileTree'

// Détection de conflits (fichiers déjà présents dans le dépôt/branche cible) et résolutions
// choisies par l'utilisateur (Remplacer/Ignorer/Renommer). Extrait de App.tsx (V2.0.0) sans
// changer le comportement.
export function useConflicts(providerRef: RefObject<GitProvider | null>) {
  const [existingPaths, setExistingPaths] = useState<Set<string> | null>(null)
  const [conflictLoading, setConflictLoading] = useState(false)
  const [conflictCheckError, setConflictCheckError] = useState<string | null>(null)
  const [conflictChoices, setConflictChoices] = useState<Map<string, ConflictResolution>>(new Map())

  async function checkConflicts(destination: Destination, files: DockedFile[]) {
    if (!providerRef.current || !destination.repo || !destination.branch) return
    setConflictLoading(true)
    setConflictCheckError(null)
    try {
      const paths = await providerRef.current.listExistingPaths(destination.repo, destination.branch)
      setExistingPaths(paths)
      // Initialise un choix "Remplacer" (comportement historique) pour chaque nouveau conflit détecté,
      // sans écraser un choix que l'utilisateur aurait déjà fait s'il navigue en avant/arrière.
      setConflictChoices((prev) => {
        const next = new Map(prev)
        for (const f of files) {
          if (f.excluded) continue
          const path = joinTargetPath(destination.targetPath, f.relativePath)
          if (paths.has(path) && !next.has(f.id)) next.set(f.id, 'replace')
        }
        return next
      })
    } catch (err) {
      setExistingPaths(null)
      setConflictCheckError(
        err instanceof Error
          ? `Impossible de vérifier les conflits (${err.message}) — les fichiers existants pourraient être écrasés sans avertissement.`
          : 'Impossible de vérifier les conflits.'
      )
    } finally {
      setConflictLoading(false)
    }
  }

  function setConflictChoice(fileId: string, resolution: ConflictResolution) {
    setConflictChoices((prev) => new Map(prev).set(fileId, resolution))
  }

  function applyBulkConflictChoice(resolution: ConflictResolution) {
    setConflictChoices((prev) => {
      const next = new Map(prev)
      for (const id of next.keys()) next.set(id, resolution)
      return next
    })
  }

  function resetConflicts() {
    setExistingPaths(null)
    setConflictLoading(false)
    setConflictCheckError(null)
    setConflictChoices(new Map())
  }

  return {
    existingPaths,
    conflictLoading,
    conflictCheckError,
    conflictChoices,
    checkConflicts,
    setConflictChoice,
    applyBulkConflictChoice,
    resetConflicts,
  }
}
