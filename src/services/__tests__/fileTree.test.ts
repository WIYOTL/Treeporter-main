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
})

describe('formatBytes', () => {
  it('formate correctement les différentes échelles', () => {
    expect(formatBytes(0)).toBe('0 o')
    expect(formatBytes(500)).toBe('500 o')
    // Sous 10 unités, une décimale est affichée (ex. "1.0 Ko" plutôt que "1 Ko")
    expect(formatBytes(1024)).toBe('1.0 Ko')
    expect(formatBytes(1024 * 1024)).toBe('1.0 Mo')
    expect(formatBytes(15 * 1024)).toBe('15 Ko')
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
})
