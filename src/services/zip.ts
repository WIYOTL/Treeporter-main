import { unzipSync } from 'fflate'
import type { DockedFile } from '../types'
import { createDockedFile, InvalidPathError } from './fileTree'
import { MessageError } from '../i18n/message'

// Extraction d'une archive .zip en fichiers "dockés", en réutilisant la même
// normalisation (NFC, exclusions par défaut, seuil "volumineux") que la
// sélection de fichiers/dossiers classique — une seule logique, deux points d'entrée.
// Le chemin relatif est passé explicitement à createDockedFile pour ne pas
// dépendre de la propriété native webkitRelativePath (readonly sur certains
// navigateurs, notamment Safari/iOS).
export async function zipToDocked(zipFile: File): Promise<DockedFile[]> {
  const buffer = new Uint8Array(await zipFile.arrayBuffer())

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(buffer)
  } catch {
    throw new MessageError({ key: 'dock.zipUnreadable', values: { filename: zipFile.name } })
  }

  const files: DockedFile[] = []
  for (const [path, data] of Object.entries(entries)) {
    // Les entrées de dossier se terminent par "/" et n'ont pas de contenu à envoyer.
    if (path.endsWith('/')) continue

    try {
      files.push(createDockedFile(
        new File([new Uint8Array(data)], path.split('/').pop() || path),
        path
      ))
    } catch (error) {
      if (error instanceof InvalidPathError) {
        throw new MessageError({
          key: 'errors.invalidArchivePath',
          values: { path: error.path },
          related: { key: error.reason },
        })
      }
      throw error
    }
  }

  if (files.length === 0) {
    throw new MessageError({ key: 'dock.zipEmpty', values: { filename: zipFile.name } })
  }

  return files
}
