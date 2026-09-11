import type { DockedFile } from '../types'

export class InvalidPathError extends Error {
  constructor(
    readonly path: string,
    readonly reason: string
  ) {
    super(`Chemin invalide "${path}" : ${reason}`)
    this.name = 'InvalidPathError'
  }
}

export function canonicalizeRelativePath(rawPath: string): string {
  if (!rawPath) {
    throw new InvalidPathError(rawPath, 'le chemin est vide')
  }

  const normalizedSeparators = rawPath.replace(/\\/g, '/')

  if (normalizedSeparators.startsWith('/')) {
    throw new InvalidPathError(
      rawPath,
      'les chemins absolus ne sont pas autorisés'
    )
  }

  const segments = normalizedSeparators.split('/')

  if (segments.some((segment) => segment.length === 0)) {
    throw new InvalidPathError(
      rawPath,
      'le chemin contient un segment vide'
    )
  }

  if (segments.some((segment) => segment === '.')) {
    throw new InvalidPathError(
      rawPath,
      'le segment "." n’est pas autorisé'
    )
  }

  if (segments.some((segment) => segment === '..')) {
    throw new InvalidPathError(
      rawPath,
      'le segment ".." n’est pas autorisé'
    )
  }

  return segments
    .map((segment) => segment.normalize('NFC'))
    .join('/')
}

export function getTargetPathError(targetPath: string): string | null {
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
      : 'le chemin est invalide'
  }
}

const DEFAULT_IGNORE_PATTERNS: Array<{
  test: (path: string) => boolean
  reason: string
}> = [
  {
    test: (path) => path.split('/').includes('.git'),
    reason: 'dossier .git',
  },
  {
    test: (path) => path.split('/').includes('node_modules'),
    reason: 'dossier node_modules',
  },
  {
    test: (path) => path.endsWith('.DS_Store'),
    reason: 'fichier système macOS',
  },
  {
    test: (path) => path.toLowerCase().endsWith('thumbs.db'),
    reason: 'fichier système Windows',
  },
  {
    test: (path) => path.split('/').some((segment) => segment.startsWith('._')),
    reason: 'fichier fantôme macOS',
  },
  {
    test: (path) => path.endsWith('.env'),
    reason: 'fichier de secrets (.env)',
  },
]

export const LARGE_FILE_THRESHOLD_BYTES = 20 * 1024 * 1024

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

    const relativePath = canonicalizeRelativePath(rawPath)
    const match = DEFAULT_IGNORE_PATTERNS.find((pattern) =>
      pattern.test(relativePath)
    )

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

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 o'
  }

  const units = ['o', 'Ko', 'Mo', 'Go']
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / Math.pow(1024, unitIndex)

  return `${
    value < 10 && unitIndex > 0
      ? value.toFixed(1)
      : Math.round(value)
  } ${units[unitIndex]}`
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

  const canonicalTargetPath =
    canonicalizeRelativePath(trimmedTarget)

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