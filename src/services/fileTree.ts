import type { DockedFile } from '../types'

// Motifs exclus par défaut de l'envoi (fichiers/dossiers techniques indésirables)
const DEFAULT_IGNORE_PATTERNS: Array<{ test: (path: string) => boolean; reason: string }> = [
  { test: (p) => p.split('/').includes('.git'), reason: 'dossier .git' },
  { test: (p) => p.split('/').includes('node_modules'), reason: 'dossier node_modules' },
  { test: (p) => p.endsWith('.DS_Store'), reason: 'fichier système macOS' },
  { test: (p) => p.toLowerCase().endsWith('thumbs.db'), reason: 'fichier système Windows' },
  { test: (p) => p.split('/').some((seg) => seg.startsWith('._')), reason: 'fichier fantôme macOS' },
  { test: (p) => p.endsWith('.env'), reason: 'fichier de secrets (.env)' },
]

// Au-delà de ce seuil, l'encodage base64 en mémoire peut ralentir Safari sur iPhone —
// on avertit simplement l'utilisateur, sans bloquer l'envoi.
export const LARGE_FILE_THRESHOLD_BYTES = 20 * 1024 * 1024 // 20 Mo

let counter = 0
function nextId() {
  counter += 1
  return `f${Date.now().toString(36)}${counter}`
}

export function filesToDocked(fileList: FileList | File[]): DockedFile[] {
  const files = Array.from(fileList)
  return files.map((file) => {
    const anyFile = file as File & { webkitRelativePath?: string }
    const rawPath = anyFile.webkitRelativePath && anyFile.webkitRelativePath.length > 0
      ? anyFile.webkitRelativePath
      : file.name

    // iOS/macOS stockent les noms de fichiers accentués en Unicode NFD (décomposé) : "é" peut
    // arriver comme "e" + accent combinant. On normalise en NFC pour que le chemin envoyé à
    // GitHub corresponde exactement à ce qui est affiché, et évite les doublons silencieux.
    const relativePath = rawPath.normalize('NFC')

    const match = DEFAULT_IGNORE_PATTERNS.find((p) => p.test(relativePath))

    return {
      id: nextId(),
      relativePath,
      file,
      size: file.size,
      excluded: Boolean(match),
      excludeReason: match?.reason,
      isLarge: file.size > LARGE_FILE_THRESHOLD_BYTES,
    }
  })
}

/** Fusionne un nouvel ajout dans la liste existante ; les chemins identiques sont remplacés.
 *  Retourne aussi la liste des chemins qui existaient déjà et ont été écrasés, pour pouvoir
 *  en avertir l'utilisateur plutôt que de les remplacer silencieusement. */
export function mergeDocked(
  existing: DockedFile[],
  added: DockedFile[]
): { files: DockedFile[]; overwritten: string[] } {
  const byPath = new Map(existing.map((f) => [f.relativePath, f]))
  const overwritten: string[] = []
  for (const item of added) {
    if (byPath.has(item.relativePath)) overwritten.push(item.relativePath)
    byPath.set(item.relativePath, item)
  }
  return { files: Array.from(byPath.values()), overwritten }
}

export function totalSize(files: DockedFile[]): number {
  return files.reduce((sum, f) => (f.excluded ? sum : sum + f.size), 0)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

/** Structure en arbre pour l'affichage pliable dans l'écran Dock */
export interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  file?: DockedFile
}

export function buildTree(files: DockedFile[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const docked of files) {
    const segments = docked.relativePath.split('/')
    let level = root
    let pathSoFar = ''

    segments.forEach((segment, index) => {
      pathSoFar = pathSoFar ? `${pathSoFar}/${segment}` : segment
      const isLast = index === segments.length - 1

      let node = level.find((n) => n.name === segment && n.isFolder === !isLast)
      if (!node) {
        node = { name: segment, path: pathSoFar, isFolder: !isLast, children: [] }
        level.push(node)
      }
      if (isLast) {
        node.file = docked
      }
      level = node.children
    })
  }

  return root
}

export function joinTargetPath(targetPath: string, relativePath: string): string {
  const cleanTarget = targetPath.replace(/^\/+|\/+$/g, '').trim()
  return cleanTarget ? `${cleanTarget}/${relativePath}` : relativePath
}

/** Propose un chemin alternatif ("nom (2).ext") quand le chemin d'origine existe déjà dans le
 *  dépôt, en incrémentant jusqu'à trouver un chemin libre parmi les chemins existants connus. */
export function resolveRenamedPath(path: string, existingPaths: Set<string>): string {
  const slashIdx = path.lastIndexOf('/')
  const dir = slashIdx >= 0 ? path.slice(0, slashIdx + 1) : ''
  const base = slashIdx >= 0 ? path.slice(slashIdx + 1) : path
  const dotIdx = base.lastIndexOf('.')
  const stem = dotIdx > 0 ? base.slice(0, dotIdx) : base
  const ext = dotIdx > 0 ? base.slice(dotIdx) : ''

  let n = 2
  let candidate = `${dir}${stem} (${n})${ext}`
  while (existingPaths.has(candidate)) {
    n += 1
    candidate = `${dir}${stem} (${n})${ext}`
  }
  return candidate
}
