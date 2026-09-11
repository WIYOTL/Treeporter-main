import { describe, it, expect } from 'vitest'
import { detectTokenType } from '../tokenType'

describe('detectTokenType', () => {
  it('reconnaît un token classique', () => {
    expect(detectTokenType('ghp_abc123')).toBe('classic')
  })

  it('reconnaît un token fine-grained', () => {
    expect(detectTokenType('github_pat_abc123')).toBe('fine-grained')
  })

  it('reconnaît un token OAuth', () => {
    expect(detectTokenType('gho_abc123')).toBe('oauth')
  })

  it('reconnaît un token GitHub App (utilisateur ou serveur)', () => {
    expect(detectTokenType('ghu_abc123')).toBe('app')
    expect(detectTokenType('ghs_abc123')).toBe('app')
  })

  it('retombe sur "inconnu" pour un format non reconnu', () => {
    expect(detectTokenType('xyz_abc123')).toBe('inconnu')
  })

  it('ignore les espaces avant/après (copier-coller iOS)', () => {
    expect(detectTokenType('  ghp_abc123  ')).toBe('classic')
  })
})
