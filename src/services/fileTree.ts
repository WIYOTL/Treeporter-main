import type { DockedFile } from '../types'
import type { Locale, MessageKey } from '../i18n/messages'
import type { MessageDescriptor } from '../i18n/message'
import { messages } from '../i18n/messages'

export class InvalidPathError extends Error {
  constructor(
    readonly path: string,
    readonly reason: MessageKey
  ) {
    super(`Chemin invalide "${path}" : ${reason}`)
    this.name = 'InvalidPathError'
  }
}

export function canonicalizeRelativePath(rawPath: string): string {
  if (!rawPath) {
    throw new InvalidPathError(rawPath, 'path.empty')
  }

  const normalizedSeparators = rawPath.replace(/\\/g, '/')

  if (normalizedSeparators.startsWith('/')) {
    throw new InvalidPathError(
      rawPath,
      'path.absolute'
    )
  }

  const segments = normalizedSeparators.split('/')

  if (segments.some((segment) => segment.length === 0)) {
    throw new InvalidPathError(
      rawPath,
      'path.emptySegment'
    )
  }

  if (segments.some((segment) => segment === '.')) {
    throw new InvalidPathError(
      rawPath,
      'path.dotSegment'
    )
  }

  if (segments.some((segment) => segment === '..')) {
    throw new InvalidPathError(
      rawPath,
      'path.parentSegment'
    )
  }

  return segments
    .map((segment) => segment.normalize('NFC'))
    .join('/')
}

export function getTargetPathError(targetPath: string): MessageKey | null {
  const trimmedPath = targetPath.trim()

  if (!trimmedPath) {
    return null
  }

  try {
    canonicalizeRelativePath(trimmedPath)
    return null
  } catch (error) {
    return error instanceof InvalidPathError
      ? error.reason
      : 'path.invalid'
  }
}

const DEFAULT_IGNORE_PATTERNS: Array<{
  test: (path: string) => boolean
  reason: MessageKey
}> = [
  {
    test: (path) => path.split('/').includes('.git'),
    reason: 'file.exclude.git',
  },
  {
    test: (path) => path.split('/').includes('node_modules'),
    reason: 'file.exclude.nodeModules',
  },
  {
    test: (path) => path.endsWith('.DS_Store'),
    reason: 'file.exclude.macSystem',
  },
  {
    test: (path) => path.toLowerCase().endsWith('thumbs.db'),
    reason: 'file.exclude.windowsSystem',
  },
  {
    test: (path) => path.split('/').some((segment) => segment.startsWith('._')),
    reason: 'file.exclude.macGhost',
  },
  {
    test: (path) => /\.env(\.\w+)*$/.test(path),
    reason: 'file.exclude.env',
  },
]

export const LARGE_FILE_THRESHOLD_BYTES = 20 * 1024 * 1024
// Limite GitHub API : 100 Mo par fichier (sans Git LFS)
export const MAX_GITHUB_FILE_SIZE_BYTES = 100 * 1024 * 1024
// Limite recommandée par GitHub : 1 Go par commit (pour éviter les problèmes)
export const MAX_RECOMMENDED_COMMIT_SIZE_BYTES = 1 * 1024 * 1024 * 1024
// Nombre maximum de fichiers par commit pour éviter le rate limiting (5000 requêtes/h)
// Chaque fichier nécessite 1 requête pour le blob, + 3-4 requêtes pour l'arbre/commit/ref
// On limite à 1000 fichiers par commit pour rester largement sous la limite
export const MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT = 1000
// Taille maximale totale supportée par Treeporter (1 Go)
export const MAX_TOTAL_SIZE_BYTES = 1 * 1024 * 1024 * 1024

let counter = 0

function nextId(): string {
  counter += 1
  return `f${Date.now().toString(36)}${counter}`
}

export function filesToDocked(
  fileList: FileList | File[]
): DockedFile[] {
  const files = Array.from(fileList)

  return files.map((file) => {
    const fileWithRelativePath = file as File & {
      webkitRelativePath?: string
    }

    const rawPath =
      fileWithRelativePath.webkitRelativePath &&
      fileWithRelativePath.webkitRelativePath.length > 0
        ? fileWithRelativePath.webkitRelativePath
        : file.name

    return createDockedFile(file, rawPath)
  })
}

/**
 * Crée un DockedFile à partir d'un File et d'un chemin relatif explicite.
 * Utilisé par l'import ZIP pour ne pas dépendre de la propriété native
 * webkitRelativePath (readonly sur certains navigateurs, notamment Safari/iOS).
 */
export function createDockedFile(file: File, relativePath: string): DockedFile {
  const canonicalRelativePath = canonicalizeRelativePath(relativePath)
  const match = DEFAULT_IGNORE_PATTERNS.find((pattern) =>
    pattern.test(canonicalRelativePath)
  )

  // Vérifier si le fichier est trop grand pour GitHub API (100 Mo)
  const isTooLarge = file.size > MAX_GITHUB_FILE_SIZE_BYTES

  return {
    id: nextId(),
    relativePath: canonicalRelativePath,
    file,
    size: file.size,
    excluded: Boolean(match) || isTooLarge,
    excludeReason: isTooLarge
      ? 'file.exclude.githubLimit'
      : match?.reason,
    isLarge: file.size > LARGE_FILE_THRESHOLD_BYTES,
    isTooLarge,
  }
}

export function mergeDocked(
  existing: DockedFile[],
  added: DockedFile[]
): {
  files: DockedFile[]
  overwritten: string[]
} {
  const byPath = new Map(
    existing.map((file) => [file.relativePath, file])
  )
  const overwritten: string[] = []

  for (const item of added) {
    if (byPath.has(item.relativePath)) {
      overwritten.push(item.relativePath)
    }

    byPath.set(item.relativePath, item)
  }

  return {
    files: Array.from(byPath.values()),
    overwritten,
  }
}

export function totalSize(files: DockedFile[]): number {
  return files.reduce(
    (sum, file) => (file.excluded ? sum : sum + file.size),
    0
  )
}

/** Vérifie si un ensemble de fichiers dépasse les limites recommandées */
export function checkTransferLimits(files: DockedFile[]): {
  totalSize: number
  fileCount: number
  hasTooLargeFiles: boolean
  exceedsCommitSize: boolean
  exceedsFileCount: boolean
  exceedsTotalSize: boolean
  batchCount: number
} {
  const includedFiles = files.filter((f) => !f.excluded)
  const totalSizeValue = totalSize(includedFiles)
  const fileCount = includedFiles.length
  // Vérifier tous les fichiers pour hasTooLargeFiles, pas seulement les inclus
  const hasTooLargeFiles = files.some((f) => f.isTooLarge)
  const exceedsCommitSize = totalSizeValue > MAX_RECOMMENDED_COMMIT_SIZE_BYTES
  const exceedsFileCount = fileCount > MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT
  const exceedsTotalSize = totalSizeValue > MAX_TOTAL_SIZE_BYTES

  // Calculer le nombre de batches nécessaires pour le fractionnement
  const batchCount = calculateBatchCount(includedFiles)

  return {
    totalSize: totalSizeValue,
    fileCount,
    hasTooLargeFiles,
    exceedsCommitSize,
    exceedsFileCount,
    exceedsTotalSize,
    batchCount,
  }
}

/** Calcule le nombre de batches (commits) nécessaires pour transférer les fichiers */
export function calculateBatchCount(files: DockedFile[]): number {
  const includedFiles = files.filter((f) => !f.excluded)
  if (includedFiles.length === 0) return 0

  let batchCount = 0
  let currentBatchSize = 0
  let currentBatchFileCount = 0

  for (const file of includedFiles) {
    // Si ajout de ce fichier dépasse les limites du batch, créer un nouveau batch
    if (currentBatchFileCount > 0 &&
        (currentBatchSize + file.size > MAX_RECOMMENDED_COMMIT_SIZE_BYTES ||
         currentBatchFileCount >= MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT)) {
      batchCount++
      currentBatchSize = 0
      currentBatchFileCount = 0
    }

    currentBatchSize += file.size
    currentBatchFileCount++
  }

  // Compter le dernier batch
  if (currentBatchFileCount > 0) {
    batchCount++
  }

  return batchCount
}

/** Fractionne les fichiers en batches pour le transfert */
export function splitFilesIntoBatches(files: DockedFile[]): DockedFile[][] {
  const includedFiles = files.filter((f) => !f.excluded)
  const batches: DockedFile[][] = []

  let currentBatch: DockedFile[] = []
  let currentBatchSize = 0
  let currentBatchFileCount = 0

  for (const file of includedFiles) {
    // Si ajout de ce fichier dépasse les limites du batch, finaliser le batch actuel
    if (currentBatchFileCount > 0 &&
        (currentBatchSize + file.size > MAX_RECOMMENDED_COMMIT_SIZE_BYTES ||
         currentBatchFileCount >= MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT)) {
      batches.push(currentBatch)
      currentBatch = []
      currentBatchSize = 0
      currentBatchFileCount = 0
    }

    currentBatch.push(file)
    currentBatchSize += file.size
    currentBatchFileCount++
  }

  // Ajouter le dernier batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

/** Retourne un message d'erreur si les limites sont dépassées */
export function getTransferLimitError(
  files: DockedFile[],
  locale: Locale = 'fr'
): MessageDescriptor | null {
  const limits = checkTransferLimits(files)

  if (limits.hasTooLargeFiles) {
    return {
      key: 'errors.transferContainsLargeFiles',
      values: { limit: formatBytes(MAX_GITHUB_FILE_SIZE_BYTES, locale) },
    }
  }

  if (limits.exceedsTotalSize) {
    return {
      key: 'errors.transferExceedsMaxSize',
      values: { limit: formatBytes(MAX_TOTAL_SIZE_BYTES, locale) },
    }
  }

  return null
}

export function formatBytes(bytes: number, locale: Locale = 'fr'): string {
  if (bytes === 0) {
    return `${new Intl.NumberFormat(locale).format(0)} ${messages[locale]['format.byte']}`
  }

  const units: MessageKey[] = ['format.byte', 'format.kilobyte', 'format.megabyte', 'format.gigabyte']
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / Math.pow(1024, unitIndex)

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0,
    maximumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0,
  }).format(value)
  return `${formatted} ${messages[locale][units[unitIndex]]}`
}

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
      pathSoFar = pathSoFar
        ? `${pathSoFar}/${segment}`
        : segment

      const isLast = index === segments.length - 1
      let node = level.find(
        (item) => item.name === segment && item.isFolder === !isLast
      )

      if (!node) {
        node = {
          name: segment,
          path: pathSoFar,
          isFolder: !isLast,
          children: [],
        }
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

export function joinTargetPath(
  targetPath: string,
  relativePath: string
): string {
  const trimmedTarget = targetPath.trim()
  const canonicalRelativePath =
    canonicalizeRelativePath(relativePath)

  if (!trimmedTarget) {
    return canonicalRelativePath
  }

  // Nettoyer les slashes au début et à la fin du chemin cible avant normalisation
  const cleanedTarget = trimmedTarget.replace(/^\/+|\/+$/g, '')

  if (!cleanedTarget) {
    return canonicalRelativePath
  }

  const canonicalTargetPath =
    canonicalizeRelativePath(cleanedTarget)

  return canonicalizeRelativePath(
    `${canonicalTargetPath}/${canonicalRelativePath}`
  )
}

export function resolveRenamedPath(
  path: string,
  existingPaths: Set<string>
): string {
  const canonicalPath = canonicalizeRelativePath(path)
  const slashIndex = canonicalPath.lastIndexOf('/')

  const directory =
    slashIndex >= 0
      ? canonicalPath.slice(0, slashIndex + 1)
      : ''

  const base =
    slashIndex >= 0
      ? canonicalPath.slice(slashIndex + 1)
      : canonicalPath

  const dotIndex = base.lastIndexOf('.')
  const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base
  const extension = dotIndex > 0 ? base.slice(dotIndex) : ''

  let suffix = 2
  let candidate = `${directory}${stem} (${suffix})${extension}`

  while (existingPaths.has(candidate)) {
    suffix += 1
    candidate = `${directory}${stem} (${suffix})${extension}`
  }

  return canonicalizeRelativePath(candidate)
}
