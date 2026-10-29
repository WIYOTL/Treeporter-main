import { describe, expect, it } from 'vitest'
import en from '../messages/en'
import fr from '../messages/fr'

describe('translation catalogs', () => {
  it('keep exactly the same keys in French and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  it('provide dedicated user-facing error messages for 409, 422, 5xx, transfers and conflict checks in both languages', () => {
    const errorKeys = ['errors.conflict', 'errors.validation', 'errors.serverError', 'errors.transfer', 'errors.conflictCheck'] as const

    for (const key of errorKeys) {
      expect(typeof fr[key]).toBe('string')
      expect(fr[key].length).toBeGreaterThan(0)
      expect(typeof en[key]).toBe('string')
      expect(en[key].length).toBeGreaterThan(0)
    }

    expect(fr['errors.conflict']).toContain('Conflit')
    expect(fr['errors.conflict']).toContain('Réessayez')
    expect(en['errors.conflict']).toContain('Conflict')
    expect(en['errors.conflict']).toContain('Retry')

    expect(fr['errors.validation']).toContain('invalide')
    expect(en['errors.validation']).toContain('invalid')

    expect(fr['errors.serverError']).toContain('erreur')
    expect(fr['errors.serverError']).toContain('réessayer')
    expect(en['errors.serverError']).toContain('error')
    expect(en['errors.serverError']).toContain('try again')
    expect((fr['errors.serverError'] + en['errors.serverError']).toLowerCase()).not.toContain('temporary')
    expect((fr['errors.serverError'] + en['errors.serverError']).toLowerCase()).not.toContain('temporaire')

    expect(fr['errors.conflictCheck']).toContain('conflits')
    expect(en['errors.conflictCheck']).toContain('conflicts')
    // Les deux langues indiquent qu'il n'y a pas de résolution automatique des doublons.
    expect(fr['errors.conflictCheck']).toMatch(/ne.*pas.*automat|automat.*pas/)
    expect(en['errors.conflictCheck']).toMatch(/will not.*automat|automat.*will not/)

    expect(fr['errors.transfer']).toContain('Échec')
    expect(en['errors.transfer']).toContain('failed')
  })
})
