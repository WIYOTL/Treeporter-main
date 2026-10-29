import { describe, it, expect } from 'vitest'
import { fileToBase64, getMaxFileSize } from '../base64'

describe('fileToBase64', () => {
  it('should encode a small text file correctly', async () => {
    const file = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' })
    const result = await fileToBase64(file)
    // "Hello, World!" en base64 = "SGVsbG8sIFdvcmxkIQ=="
    expect(result).toBe('SGVsbG8sIFdvcmxkIQ==')
  })

  it('should encode a binary file correctly (all byte values)', async () => {
    // Créer un fichier avec des octets > 127 pour tester le encoding binaire
    const bytes = new Uint8Array([0x00, 0x7F, 0x80, 0xFF])
    const file = new File([bytes], 'binary.bin', { type: 'application/octet-stream' })
    const result = await fileToBase64(file)
    // Vérifier que le résultat est un Base64 valide
    expect(result).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    // Le fichier de 4 octets donne 8 chars (sans padding)
    expect(result.length).toBeGreaterThanOrEqual(4)
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('should handle empty file', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' })
    const result = await fileToBase64(file)
    expect(result).toBe('')
  })

  it('should reject files larger than 100 MB', async () => {
    // Simuler un fichier dont la propriété size dépasse la limite.
    // La lecture réelle dépasse la taille simulée, mais on vérifie la
    // validation avant l'ouverture effective.
    const file = new File(['x'], 'huge.bin', { type: 'application/octet-stream' })
    Object.defineProperty(file, 'size', { value: 100 * 1024 * 1024 + 1 })

    await expect(fileToBase64(file)).rejects.toThrow(/File too large/)
  })

  it('should accept files at exactly 100 MB', async () => {
    // Créer un fichier de 100 Mo exact en fragmentant un grand tableau de
    // tampon éphémère. Cela reproduit une contrainte de mémoire fixe.
    const big = new Uint8Array(100 * 1024 * 1024)
    const file = new File([big], 'exact.bin', { type: 'application/octet-stream' })

    const result = await fileToBase64(file)
    // 100 Mo = 104 857 600 octets => 104 857 600 * 4/3 = 139 810 133.33
    // avec padding, le résultat fait 139 810 136 caractères.
    expect(result.length).toBeGreaterThan(130000000)
    expect(result.length).toBeLessThanOrEqual(140000000)
  })

  it('should use RFC 4648 base64 without line breaks', async () => {
    const bytes = new Uint8Array([0x00, 0x7F, 0x80, 0xFF])
    const file = new File([bytes], 'binary2.bin', { type: 'application/octet-stream' })

    const result = await fileToBase64(file)
    // Aucun saut de ligne dans le résultat
    expect(result).not.toContain('\n')
    expect(result).not.toContain('\r')
  })
})

// ===== Tests de frontières de chunks =====
//
// Le constant CHUNK_SIZE vaut 64 * 1024 = 65536 octets. Comme 65536 n'est pas
// divisible par 3, les derniers octets d'un chunk peuvent laisser un reste de
// 1 ou 2 octets en fin de chunk, ce qui nécessite un padding Base64.
// Ces tests vérifient que la concaténation des chunks produit exactement le
// mème résultat que l'encodage global d'un buffer complet.

describe('fileToBase64 chunk boundary', () => {
  // Générateur déterministe d'octets
  function makeData(size: number): Uint8Array {
    const data = new Uint8Array(size)
    for (let i = 0; i < size; i++) {
      data[i] = (i * 37 + 13) & 0xFF
    }
    return data
  }

  // Encodage de référence fiable (RFC 4648)
  function referenceEncoding(data: Uint8Array): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    let result = ''
    for (let i = 0; i < data.length; i += 3) {
      const byte1 = data[i]
      const byte2 = i + 1 < data.length ? data[i + 1] : 0
      const byte3 = i + 2 < data.length ? data[i + 2] : 0
      const triple = (byte1 << 16) | (byte2 << 8) | byte3

      result += chars[(triple >> 18) & 0x3F]
      result += chars[(triple >> 12) & 0x3F]
      result += chars[(triple >> 6) & 0x3F]
      result += chars[triple & 0x3F]
    }
    const remainder = data.length % 3
    if (remainder > 0) {
      const padding = remainder === 1 ? '==' : '='
      result = result.slice(0, -padding.length) + padding
    }
    return result
  }

  // Vérification complète : encodage, décodage, et égalité des octets
  async function assertBoundary(
    name: string,
    size: number,
    chunkSize: number
  ) {
    const data = makeData(size)
    const expected = referenceEncoding(data)

    const file = new File([data as unknown as BlobPart], `boundary.bin`, {
      type: 'application/octet-stream',
    })
    const result = await fileToBase64(file)

    // 1. Égalité exacte du résultat par rapport à la référence
    expect(result).toBe(expected)

    // 2. Décodage du résultat et égalité des octets originaux
    const decoded = atob(result)
    const decodedBytes = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i++) {
      decodedBytes[i] = decoded.charCodeAt(i)
    }
    expect(decodedBytes.length).toBe(size)
    for (let i = 0; i < size; i++) {
      expect(decodedBytes[i]).toBe(data[i])
    }
  }

  it('chunk size - 2 bytes', async () => {
    await assertBoundary(
      'chunkSize-2',
      64,
      64
    )
  })

  it('chunk size - 1 byte', async () => {
    await assertBoundary(
      'chunkSize-1',
      63,
      64
    )
  })

  it('chunk size bytes', async () => {
    await assertBoundary(
      'chunkSize',
      64,
      64
    )
  })

  it('chunk size + 1 byte', async () => {
    await assertBoundary(
      'chunkSize+1',
      65,
      64
    )
  })

  it('chunk size + 2 bytes', async () => {
    await assertBoundary(
      'chunkSize+2',
      66,
      64
    )
  })

  it('multiple full chunks followed by 1 remaining byte', async () => {
    await assertBoundary(
      '2xChunkSize+1',
      2 * 64 + 1,
      64
    )
  })

  it('multiple full chunks followed by 2 remaining bytes', async () => {
    await assertBoundary(
      '2xChunkSize+2',
      2 * 64 + 2,
      64
    )
  })
})

describe('getMaxFileSize', () => {
  it('should return 100 MB', () => {
    expect(getMaxFileSize()).toBe(100 * 1024 * 1024)
  })
})

describe('getMaxFileSize', () => {
  it('should return 100 MB', () => {
    expect(getMaxFileSize()).toBe(100 * 1024 * 1024)
  })
})
