import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { zipToDocked } from '../zip'

function archiveFile(name: string, bytes: Uint8Array): File {
  return {
    name,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as File
}

describe('zip error messages', () => {
  it('returns a localized descriptor for an unreadable archive without rewriting its filename', async () => {
    await expect(zipToDocked(archiveFile('bad backup.zip', new Uint8Array([1, 2, 3])))).rejects.toMatchObject({
      userMessage: { key: 'dock.zipUnreadable', values: { filename: 'bad backup.zip' } },
    })
  })

  it('returns a localized descriptor for an archive with no usable files', async () => {
    const emptyArchive = zipSync({})
    await expect(zipToDocked(archiveFile('empty.zip', emptyArchive))).rejects.toMatchObject({
      userMessage: { key: 'dock.zipEmpty', values: { filename: 'empty.zip' } },
    })
  })
})

describe('zip extraction preserves archive structure', () => {
  it('extracts a single file at root with correct relative path', async () => {
    const archive = zipSync({ 'hello.txt': new Uint8Array([72, 101, 108, 108, 111]) })
    const result = await zipToDocked(archiveFile('test.zip', archive))

    expect(result).toHaveLength(1)
    expect(result[0].relativePath).toBe('hello.txt')
    expect(result[0].excluded).toBe(false)
  })

  it('extracts multiple files at root', async () => {
    const archive = zipSync({
      'a.txt': new Uint8Array([1]),
      'b.txt': new Uint8Array([2]),
      'c.txt': new Uint8Array([3]),
    })
    const result = await zipToDocked(archiveFile('multi.zip', archive))

    expect(result).toHaveLength(3)
    const paths = result.map((f) => f.relativePath).sort()
    expect(paths).toEqual(['a.txt', 'b.txt', 'c.txt'])
  })

  it('preserves subdirectory structure from zip entries', async () => {
    const archive = zipSync({
      'folder/file.txt': new Uint8Array([1, 2, 3]),
      'folder/sub/deep.txt': new Uint8Array([4, 5]),
      'top.txt': new Uint8Array([6]),
    })
    const result = await zipToDocked(archiveFile('nested.zip', archive))

    expect(result).toHaveLength(3)
    const paths = result.map((f) => f.relativePath).sort()
    expect(paths).toEqual(['folder/file.txt', 'folder/sub/deep.txt', 'top.txt'])
  })

  it('excludes directory entries ending with slash', async () => {
    const archive = zipSync({
      'folder/': new Uint8Array([]),
      'folder/file.txt': new Uint8Array([1]),
    })
    const result = await zipToDocked(archiveFile('with-dirs.zip', archive))

    expect(result).toHaveLength(1)
    expect(result[0].relativePath).toBe('folder/file.txt')
  })

  it('handles empty files (0 bytes)', async () => {
    const archive = zipSync({ 'empty.txt': new Uint8Array([]) })
    const result = await zipToDocked(archiveFile('empty-file.zip', archive))

    expect(result).toHaveLength(1)
    expect(result[0].size).toBe(0)
    expect(result[0].relativePath).toBe('empty.txt')
  })

  it('preserves filenames with accents and special characters', async () => {
    const archive = zipSync({
      'fichier-avec-accents-éàç.txt': new Uint8Array([1]),
      'file with spaces.txt': new Uint8Array([2]),
      'underscore_and-hyphen.txt': new Uint8Array([3]),
    })
    const result = await zipToDocked(archiveFile('special.zip', archive))

    expect(result).toHaveLength(3)
    const paths = result.map((f) => f.relativePath).sort()
    expect(paths).toEqual([
      'fichier-avec-accents-éàç.txt',
      'file with spaces.txt',
      'underscore_and-hyphen.txt',
    ])
  })

  it('handles multiple files with same basename in different subdirectories', async () => {
    const archive = zipSync({
      'dir1/config.json': new Uint8Array([1]),
      'dir2/config.json': new Uint8Array([2]),
    })
    const result = await zipToDocked(archiveFile('same-basename.zip', archive))

    expect(result).toHaveLength(2)
    const paths = result.map((f) => f.relativePath).sort()
    expect(paths).toEqual(['dir1/config.json', 'dir2/config.json'])
  })

  it('keeps real files from zip archives containing macOS artifacts', async () => {
    const archive = zipSync({
      '__MACOSX/._file.txt': new Uint8Array([1]),
      '.DS_Store': new Uint8Array([2]),
      'real.txt': new Uint8Array([3]),
    })
    const result = await zipToDocked(archiveFile('macos.zip', archive))

    expect(result.some((f) => f.relativePath === 'real.txt')).toBe(true)
  })

  it('excludes files larger than 100 MB from zip', async () => {
    const largeData = new Uint8Array(101 * 1024 * 1024) // 101 MB
    const archive = zipSync({ 'large.bin': largeData })
    const result = await zipToDocked(archiveFile('large.zip', archive))

    expect(result).toHaveLength(1)
    expect(result[0].excluded).toBe(true)
    expect(result[0].isTooLarge).toBe(true)
    expect(result[0].excludeReason).toBe('file.exclude.githubLimit')
  })

  it('normalizes unicode paths to NFC', async () => {
    // 'é' can be represented as U+00E9 (NFC) or U+0065 U+0301 (NFD)
    const nfdE = 'e\u0301' // NFD form
    const archive = zipSync({ [`folder/${nfdE}file.txt`]: new Uint8Array([1]) })
    const result = await zipToDocked(archiveFile('nfc.zip', archive))

    expect(result).toHaveLength(1)
    expect(result[0].relativePath).toBe('folder/éfile.txt')
  })
})
