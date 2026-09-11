import { unzipSync } from 'fflate'
import type { DockedFile } from '../types'
import { filesToDocked } from './fileTree'

// Extraction d'une archive .zip en fichiers "dockés", en réutilisant filesToDocked pour
// garder exactement la même normalisation (NFC, exclusions par défaut, seuil "volumineux")
// que la sélection de fichiers/dossiers classique — une seule logique, deux points d'entrée.
export async function zipToDocked(zipFile: File): Promise<DockedFile[]> {
  const buffer = new Uint8Array(await zipFile.arrayBuffer())

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(buffer)
  } catch {
    throw new Error(`Impossible de lire "${zipFile.name}" — ce n'est peut-être pas une archive .zip valide.`)
  }

  const files: File[] = []
  for (const [path, data] of Object.entries(entries)) {
    // Les entrées de dossier se terminent par "/" et n'ont pas de contenu à envoyer.
    if (path.endsWith('/')) continue
    const name = path.split('/').pop() || path
    const file = new File([new Uint8Array(data)], name)
    // Simule webkitRelativePath pour que filesToDocked conserve l'arborescence de l'archive,
    // exactement comme pour une sélection de dossier via webkitdirectory.
    Object.defineProperty(file, 'webkitRelativePath', { value: path })
    files.push(file)
  }

  if (files.length === 0) {
    throw new Error(`"${zipFile.name}" ne contient aucun fichier exploitable.`)
  }

  return filesToDocked(files)
}
