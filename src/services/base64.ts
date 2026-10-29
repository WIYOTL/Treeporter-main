/** Encode un ArrayBuffer en base64 par blocs pour éviter les limites d'appel de fonction sur les gros fichiers. */
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 Mo (limite GitHub API)

export async function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large: ${file.size} bytes exceeds GitHub API limit of ${MAX_FILE_SIZE_BYTES} bytes`)
  }
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000 // 32k
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/** Retourne la taille maximale autorisée pour un fichier (100 Mo pour GitHub API) */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE_BYTES
}
