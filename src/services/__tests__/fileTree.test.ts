import { describe, it, expect, beforeEach } from 'vitest'
import {
  filesToDocked,
  mergeDocked,
  totalSize,
  formatBytes,
  buildTree,
  joinTargetPath,
  resolveRenamedPath,
  LARGE_FILE_THRESHOLD_BYTES,
  MAX_GITHUB_FILE_SIZE_BYTES,
  MAX_RECOMMENDED_COMMIT_SIZE_BYTES,
  MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT,
  checkTransferLimits,
  splitFilesIntoBatches,
  calculateBatchCount,
} from '../fileTree'

// Petit helper pour simuler un fichier tel que fourni par un <input type="file">,
// avec un webkitRelativePath optionnel (comme le donnerait webkitdirectory sur iOS).
function makeFile(name: string, content: string, webkitRelativePath?: string): File {
  const file = new File([content], name, { type: 'text/plain' })
  if (webkitRelativePath) {
    Object.defineProperty(file, 'webkitRelativePath', { value: webkitRelativePath })
  }
  return file
}

describe('filesToDocked', () => {
  it('utilise le nom du fichier quand il n\'y a pas de webkitRelativePath (sélection de fichiers seuls)', () => {
    const [docked] = filesToDocked([makeFile('notes.txt', 'hello')])
    expect(docked.relativePath).toBe('notes.txt')
  })

  it('conserve l\'arborescence complète via webkitRelativePath (sélection de dossier)', () => {
    const [docked] = filesToDocked([makeFile('index.ts', 'x', 'projet/src/index.ts')])
    expect(docked.relativePath).toBe('projet/src/index.ts')
  })

  it('normalise les noms accentués en NFC (cas réel iOS/macOS, encodage NFD par défaut)', () => {
    const nfd = 'cafe\u0301.txt' // "café.txt" décomposé (e + accent combinant U+0301)
    const [docked] = filesToDocked([makeFile(nfd, 'x')])
    expect(docked.relativePath).toBe('café.txt')
    expect(docked.relativePath.normalize('NFC')).toBe(docked.relativePath)
  })

  it('conserve les espaces dans les noms de fichiers', () => {
    const [docked] = filesToDocked([makeFile('mon dossier de travail.txt', 'x')])
    expect(docked.relativePath).toBe('mon dossier de travail.txt')
  })

  it('exclut automatiquement les fichiers techniques indésirables', () => {
    const files = filesToDocked([
      makeFile('.DS_Store', 'x', 'projet/.DS_Store'),
      makeFile('index.js', 'x', 'projet/node_modules/pkg/index.js'),
      makeFile('.env', 'x', 'projet/.env'),
      makeFile('app.ts', 'x', 'projet/src/app.ts'),
    ])
    const excluded = files.filter((f) => f.excluded)
    const included = files.filter((f) => !f.excluded)
    expect(excluded).toHaveLength(3)
    expect(included).toHaveLength(1)
    expect(included[0].relativePath).toBe('projet/src/app.ts')
  })

  it('exclut les variantes .env et les chemins imbriqués', () => {
    const files = filesToDocked([
      makeFile('.env', 'secret', 'app/.env'),
      makeFile('.env.local', 'secret', 'app/.env.local'),
      makeFile('.env.production', 'secret', 'app/.env.production'),
      makeFile('.env.development', 'secret', 'config/.env.development'),
      makeFile('.env.test', 'secret', 'src/.env.test'),
      makeFile('.env.production.local', 'secret', 'app/.env.production.local'),
      makeFile('safe.txt', 'ok', 'app/safe.txt'),
    ])

    const excluded = files.filter((f) => f.excluded)
    const included = files.filter((f) => !f.excluded)

    expect(excluded).toHaveLength(6)
    expect(excluded.map((f) => f.relativePath)).toEqual([
      'app/.env',
      'app/.env.local',
      'app/.env.production',
      'config/.env.development',
      'src/.env.test',
      'app/.env.production.local',
    ])

    expect(included).toHaveLength(1)
    expect(included[0].relativePath).toBe('app/safe.txt')
  })

  it('n\'exclut pas les autres fichiers cachés non sensibles', () => {
    const files = filesToDocked([
      makeFile('.gitignore', 'x', 'app/.gitignore'),
      makeFile('.npmrc', 'x', 'app/.npmrc'),
      makeFile('.tool-versions', 'x', 'app/.tool-versions'),
      makeFile('.envrc', 'x', 'app/.envrc'),
      makeFile('index.ts', 'x', 'app/index.ts'),
    ])

    const excluded = files.filter((f) => f.excluded)
    expect(excluded).toHaveLength(0)
    expect(files).toHaveLength(5)
  })

  it('marque un fichier comme volumineux au-delà du seuil', () => {
    const bigContent = 'x'.repeat(LARGE_FILE_THRESHOLD_BYTES + 1)
    const [docked] = filesToDocked([makeFile('gros.bin', bigContent)])
    expect(docked.isLarge).toBe(true)
  })

  it('ne marque pas un petit fichier comme volumineux', () => {
    const [docked] = filesToDocked([makeFile('petit.txt', 'x')])
    expect(docked.isLarge).toBe(false)
  })

  it('génère des identifiants uniques pour chaque fichier', () => {
    const files = filesToDocked([makeFile('a.txt', 'x'), makeFile('b.txt', 'y')])
    expect(files[0].id).not.toBe(files[1].id)
  })
})

describe('mergeDocked', () => {
  it('ajoute de nouveaux fichiers sans rien écraser', () => {
    const existing = filesToDocked([makeFile('a.txt', 'x')])
    const added = filesToDocked([makeFile('b.txt', 'y')])
    const { files, overwritten } = mergeDocked(existing, added)
    expect(files).toHaveLength(2)
    expect(overwritten).toHaveLength(0)
  })

  it('remplace un fichier existant au même chemin et le signale', () => {
    const existing = filesToDocked([makeFile('a.txt', 'ancien contenu')])
    const added = filesToDocked([makeFile('a.txt', 'nouveau contenu')])
    const { files, overwritten } = mergeDocked(existing, added)
    expect(files).toHaveLength(1)
    expect(overwritten).toEqual(['a.txt'])
  })
})

describe('totalSize', () => {
  it('additionne uniquement les fichiers non exclus', () => {
    const files = filesToDocked([
      makeFile('a.txt', 'abc'), // 3 octets
      makeFile('.env', 'secret'), // exclu
    ])
    expect(totalSize(files)).toBe(3)
  })

  it('exclut toutes les variantes .env du calcul de taille', () => {
    const files = filesToDocked([
      makeFile('app.ts', 'code'), // 4 octets
      makeFile('.env', 'secret1', 'app/.env'), // exclu
      makeFile('.env.local', 'secret2', 'app/.env.local'), // exclu
      makeFile('.env.production', 'secret3', 'app/.env.production'), // exclu
    ])
    expect(totalSize(files)).toBe(4)
  })
})

describe('formatBytes', () => {
  it('formate correctement les différentes échelles', () => {
    expect(formatBytes(0)).toBe('0 o')
    expect(formatBytes(500)).toBe('500 o')
    // Sous 10 unités, une décimale est affichée (ex. "1.0 Ko" plutôt que "1 Ko")
    expect(formatBytes(1024)).toBe('1,0 Ko')
    expect(formatBytes(1024 * 1024)).toBe('1,0 Mo')
    expect(formatBytes(15 * 1024)).toBe('15 Ko')
    expect(formatBytes(1024, 'en')).toBe('1.0 KB')
    expect(formatBytes(1536, 'en')).toBe('1.5 KB')
  })
})

describe('buildTree', () => {
  it('reconstruit une arborescence à plusieurs niveaux fidèle aux chemins d\'origine', () => {
    const files = filesToDocked([
      makeFile('index.ts', 'x', 'projet/src/index.ts'),
      makeFile('utils.ts', 'x', 'projet/src/utils.ts'),
      makeFile('readme.md', 'x', 'projet/readme.md'),
    ])
    const tree = buildTree(files)
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('projet')
    expect(tree[0].isFolder).toBe(true)
    const srcFolder = tree[0].children.find((n) => n.name === 'src')
    expect(srcFolder?.children).toHaveLength(2)
  })
})

describe('joinTargetPath', () => {
  it('sans chemin cible, retourne le chemin relatif tel quel', () => {
    expect(joinTargetPath('', 'src/index.ts')).toBe('src/index.ts')
  })

  it('préfixe avec le chemin cible en nettoyant les slashes superflus', () => {
    expect(joinTargetPath('/dossier/cible/', 'src/index.ts')).toBe('dossier/cible/src/index.ts')
  })
})

describe('resolveRenamedPath', () => {
  it('propose "(2)" quand le chemin d\'origine existe déjà', () => {
    const existing = new Set(['notes.txt'])
    expect(resolveRenamedPath('notes.txt', existing)).toBe('notes (2).txt')
  })

  it('incrémente jusqu\'à trouver un chemin libre', () => {
    const existing = new Set(['notes.txt', 'notes (2).txt', 'notes (3).txt'])
    expect(resolveRenamedPath('notes.txt', existing)).toBe('notes (4).txt')
  })

  it('conserve le dossier parent dans le chemin renommé', () => {
    const existing = new Set(['src/app.ts'])
    expect(resolveRenamedPath('src/app.ts', existing)).toBe('src/app (2).ts')
  })

  it('gère un fichier sans extension', () => {
    const existing = new Set(['LISEZMOI'])
    expect(resolveRenamedPath('LISEZMOI', existing)).toBe('LISEZMOI (2)')
  })

  describe('MAX_GITHUB_FILE_SIZE_BYTES', () => {
    it('should export MAX_GITHUB_FILE_SIZE_BYTES as 100 MB', () => {
      expect(MAX_GITHUB_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024)
    })

    it('should mark files larger than 100 MB as isTooLarge and excluded', () => {
      const largeFile = makeFile('huge.bin', 'x'.repeat(100 * 1024 * 1024 + 1))
      Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 + 1 })
      const [docked] = filesToDocked([largeFile])
      expect(docked.isTooLarge).toBe(true)
      expect(docked.excluded).toBe(true)
      expect(docked.excludeReason).toBe('file.exclude.githubLimit')
    })

    it('should not mark files at exactly 100 MB as too large', () => {
      const exactFile = makeFile('exact.bin', 'x'.repeat(100 * 1024 * 1024))
      Object.defineProperty(exactFile, 'size', { value: 100 * 1024 * 1024 })
      const [docked] = filesToDocked([exactFile])
      expect(docked.isTooLarge).toBe(false)
      expect(docked.excluded).toBe(false)
    })

    it('should not mark files smaller than 100 MB as too large', () => {
      const smallFile = makeFile('small.bin', 'x'.repeat(50 * 1024 * 1024))
      Object.defineProperty(smallFile, 'size', { value: 50 * 1024 * 1024 })
      const [docked] = filesToDocked([smallFile])
      expect(docked.isTooLarge).toBe(false)
      expect(docked.excluded).toBe(false)
    })
  })

  describe('checkTransferLimits', () => {
    it('should return correct limits for empty files', () => {
      const limits = checkTransferLimits([])
      expect(limits.totalSize).toBe(0)
      expect(limits.fileCount).toBe(0)
      expect(limits.hasTooLargeFiles).toBe(false)
      expect(limits.exceedsCommitSize).toBe(false)
      expect(limits.exceedsFileCount).toBe(false)
      expect(limits.exceedsTotalSize).toBe(false)
      expect(limits.batchCount).toBe(0)
    })

    it('should detect when total size exceeds recommended commit size', () => {
      // Créer plusieurs fichiers dont la somme dépasse MAX_RECOMMENDED_COMMIT_SIZE_BYTES
      // mais chacun est < MAX_GITHUB_FILE_SIZE_BYTES pour ne pas être exclu
      const fileSizeUnderLimit = 90 * 1024 * 1024 // 90 Mo
      const numFiles = Math.ceil(MAX_RECOMMENDED_COMMIT_SIZE_BYTES / fileSizeUnderLimit) + 1
      const files = Array.from({ length: numFiles }, (_, i) =>
        makeFile(`file${i}.bin`, 'x')
      )
      files.forEach(f => Object.defineProperty(f, 'size', { value: fileSizeUnderLimit }))

      const dockedFiles = filesToDocked(files)

      const limits = checkTransferLimits(dockedFiles)
      expect(limits.totalSize).toBe(fileSizeUnderLimit * numFiles)
      expect(limits.exceedsCommitSize).toBe(true)
      expect(limits.exceedsFileCount).toBe(false)
    })

    it('should detect when file count exceeds recommended limit', () => {
      const files = Array.from({ length: MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT + 1 }, (_, i) =>
        makeFile(`file${i}.txt`, 'x')
      )
      const dockedFiles = filesToDocked(files)

      const limits = checkTransferLimits(dockedFiles)
      expect(limits.fileCount).toBe(MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT + 1)
      expect(limits.exceedsFileCount).toBe(true)
      expect(limits.exceedsCommitSize).toBe(false)
    })

    it('should detect when files contain too large files', () => {
      const largeFile = makeFile('huge.bin', 'x')
      Object.defineProperty(largeFile, 'size', { value: MAX_GITHUB_FILE_SIZE_BYTES + 1 })
      const [docked] = filesToDocked([largeFile])

      const limits = checkTransferLimits([docked])
      expect(limits.hasTooLargeFiles).toBe(true)
    })

    it('should exclude excluded files from limits', () => {
      const largeFile = makeFile('huge.bin', 'x')
      Object.defineProperty(largeFile, 'size', { value: MAX_RECOMMENDED_COMMIT_SIZE_BYTES + 1 })
      const [docked] = filesToDocked([largeFile])
      // Marquer comme exclu
      docked.excluded = true

      const limits = checkTransferLimits([docked])
      expect(limits.totalSize).toBe(0)
      expect(limits.fileCount).toBe(0)
      expect(limits.exceedsCommitSize).toBe(false)
    })

    it('should handle mixed files correctly', () => {
      const normalFile = makeFile('normal.txt', 'x')
      Object.defineProperty(normalFile, 'size', { value: 1024 })
      const largeFile = makeFile('large.bin', 'x')
      Object.defineProperty(largeFile, 'size', { value: MAX_GITHUB_FILE_SIZE_BYTES + 1 })

      const dockedFiles = filesToDocked([normalFile, largeFile])

      const limits = checkTransferLimits(dockedFiles)
      expect(limits.totalSize).toBe(1024) // Seuls les fichiers non exclus sont comptés
      expect(limits.fileCount).toBe(1)
      expect(limits.hasTooLargeFiles).toBe(true) // Le fichier large est exclu mais détécté
    })
  })

  describe('splitFilesIntoBatches', () => {
    it('should return empty array for empty input', () => {
      const batches = splitFilesIntoBatches([])
      expect(batches).toEqual([])
    })

    it('should return single batch for files under limits', () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        makeFile(`file${i}.txt`, 'x')
      )
      files.forEach(f => Object.defineProperty(f, 'size', { value: 1024 }))

      const dockedFiles = filesToDocked(files)
      const batches = splitFilesIntoBatches(dockedFiles)

      expect(batches.length).toBe(1)
      expect(batches[0].length).toBe(5)
    })

    it('should split files exceeding commit size limit', () => {
      // Créer des fichiers de 90 Mo chacun (sous la limite de 100 Mo par fichier)
      const fileSize = 90 * 1024 * 1024 // 90 Mo
      const numFiles = 15 // 15 * 90 Mo = 1,35 Go > 1 Go

      const files = Array.from({ length: numFiles }, (_, i) =>
        makeFile(`file${i}.bin`, 'x')
      )
      files.forEach(f => Object.defineProperty(f, 'size', { value: fileSize }))

      const dockedFiles = filesToDocked(files)
      const batches = splitFilesIntoBatches(dockedFiles)

      // Doit créer 2 batches : 10 fichiers (900 Mo) + 5 fichiers (450 Mo)
      expect(batches.length).toBe(2)
      expect(batches[0].length).toBe(11) // 11 * 90 Mo = 990 Mo < 1 Go
      expect(batches[1].length).toBe(4) // 4 * 90 Mo = 360 Mo
    })

    it('should split files exceeding file count limit', () => {
      const fileSize = 1024 // 1 Ko
      const numFiles = MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT + 100 // 1100 fichiers

      const files = Array.from({ length: numFiles }, (_, i) =>
        makeFile(`file${i}.txt`, 'x')
      )
      files.forEach(f => Object.defineProperty(f, 'size', { value: fileSize }))

      const dockedFiles = filesToDocked(files)
      const batches = splitFilesIntoBatches(dockedFiles)

      // Doit créer 2 batches : 1000 + 100 fichiers
      expect(batches.length).toBe(2)
      expect(batches[0].length).toBe(MAX_RECOMMENDED_FILE_COUNT_PER_COMMIT)
      expect(batches[1].length).toBe(100)
    })

    it('should exclude files from batches', () => {
      const normalFile = makeFile('normal.txt', 'x')
      Object.defineProperty(normalFile, 'size', { value: 1024 })
      const largeFile = makeFile('large.bin', 'x')
      Object.defineProperty(largeFile, 'size', { value: MAX_GITHUB_FILE_SIZE_BYTES + 1 })

      const dockedFiles = filesToDocked([normalFile, largeFile])
      const batches = splitFilesIntoBatches(dockedFiles)

      // Le fichier large est exclu, donc un seul batch avec le fichier normal
      expect(batches.length).toBe(1)
      expect(batches[0].length).toBe(1)
      expect(batches[0][0].relativePath).toBe('normal.txt')
    })
  })

  describe('calculateBatchCount', () => {
    it('should return 0 for empty files', () => {
      expect(calculateBatchCount([])).toBe(0)
    })

    it('should return 1 for files under limits', () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        makeFile(`file${i}.txt`, 'x')
      )
      files.forEach(f => Object.defineProperty(f, 'size', { value: 1024 }))

      const dockedFiles = filesToDocked(files)
      expect(calculateBatchCount(dockedFiles)).toBe(1)
    })

    it('should return correct count for files exceeding commit size', () => {
      const fileSize = 90 * 1024 * 1024 // 90 Mo
      const numFiles = 15 // 15 * 90 Mo = 1,35 Go > 1 Go

      const files = Array.from({ length: numFiles }, (_, i) =>
        makeFile(`file${i}.bin`, 'x')
      )
      files.forEach(f => Object.defineProperty(f, 'size', { value: fileSize }))

      const dockedFiles = filesToDocked(files)
      expect(calculateBatchCount(dockedFiles)).toBe(2)
    })
  })
})
