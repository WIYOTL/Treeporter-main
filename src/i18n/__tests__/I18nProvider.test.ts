import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { I18nProvider, LOCALE_STORAGE_KEY, useI18n } from '../I18nProvider'
import { PWA_MANIFEST_DESCRIPTION, PWA_MANIFEST_LOCALE } from '../metadata'

function memoryStorage(initialLocale?: string) {
  const values = new Map<string, string>()
  if (initialLocale !== undefined) values.set(LOCALE_STORAGE_KEY, initialLocale)
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage
  return { storage, values }
}

function documentStub() {
  const meta = { content: '', setAttribute(_name: string, value: string) { this.content = value } }
  return {
    documentElement: { lang: '' },
    querySelector: (selector: string) => selector === 'meta[name="description"]' ? meta : null,
    meta,
  }
}

function mountI18n() {
  let current!: ReturnType<typeof useI18n>
  let renderer!: ReactTestRenderer
  function Probe() {
    current = useI18n()
    return createElement(LanguageSwitcher)
  }
  act(() => {
    renderer = create(createElement(I18nProvider, null, createElement(Probe)))
  })
  return {
    current: () => current,
    renderer,
    unmount: () => act(() => renderer.unmount()),
  }
}

const mountedRenderers: Array<ReturnType<typeof mountI18n>> = []

function renderI18n() {
  const mounted = mountI18n()
  mountedRenderers.push(mounted)
  return mounted
}

afterEach(() => {
  mountedRenderers.splice(0).forEach(({ unmount }) => unmount())
  vi.unstubAllGlobals()
})

describe('I18nProvider', () => {
  it('defaults to French and updates HTML language and description metadata', () => {
    const { storage, values } = memoryStorage()
    const page = documentStub()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('document', page)
    const mounted = renderI18n()

    expect(mounted.current().locale).toBe('fr')
    expect(values.get(LOCALE_STORAGE_KEY)).toBe('fr')
    expect(page.documentElement.lang).toBe('fr')
    expect(page.meta.content).toBe('Envoie tes fichiers et dossiers vers GitHub en conservant leur arborescence.')
  })

  it('restores a valid saved English preference', () => {
    const { storage } = memoryStorage('en')
    const page = documentStub()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('document', page)
    const mounted = renderI18n()

    expect(mounted.current().locale).toBe('en')
    expect(mounted.current().t('language.switcherLabel')).toBe('Language')
    expect(page.documentElement.lang).toBe('en')
    expect(page.meta.content).toBe('Send files and folders to GitHub while preserving their folder structure.')
  })

  it('falls back to French and replaces an invalid stored value', () => {
    const { storage, values } = memoryStorage('de')
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('document', documentStub())
    const mounted = renderI18n()

    expect(mounted.current().locale).toBe('fr')
    expect(values.get(LOCALE_STORAGE_KEY)).toBe('fr')
  })

  it('changes language in place, exposes an accessible selector, and persists the choice', () => {
    const { storage, values } = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('document', documentStub())
    const mounted = renderI18n()
    const group = mounted.renderer.root.findByProps({ role: 'group' })
    expect(group.props['aria-label']).toBe('Langue')

    const buttons = mounted.renderer.root.findAllByType('button')
    expect(buttons[0].props.type).toBe('button')
    expect(buttons[0].props['aria-label']).toBe('Français')
    expect(buttons[0].props['aria-pressed']).toBe(true)
    expect(buttons[1].props.children).toBe('EN')
    expect(buttons[1].props['aria-label']).toBe('Anglais')
    expect(buttons[1].props['aria-pressed']).toBe(false)

    act(() => buttons[1].props.onClick())
    expect(mounted.current().locale).toBe('en')
    expect(mounted.renderer.root.findByProps({ role: 'group' }).props['aria-label']).toBe('Language')
    expect(values.get(LOCALE_STORAGE_KEY)).toBe('en')
    expect(mounted.renderer.root.findAllByType('button')[1].props['aria-pressed']).toBe(true)

    act(() => mounted.renderer.root.findAllByType('button')[0].props.onClick())
    expect(mounted.current().locale).toBe('fr')
    expect(values.get(LOCALE_STORAGE_KEY)).toBe('fr')
  })

  it('updates lang and description whenever the selected language changes', () => {
    const { storage } = memoryStorage()
    const page = documentStub()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('document', page)
    const mounted = renderI18n()

    expect(page.documentElement.lang).toBe('fr')
    act(() => mounted.current().setLocale('en'))
    expect(page.documentElement.lang).toBe('en')
    expect(page.meta.content).toBe('Send files and folders to GitHub while preserving their folder structure.')
  })

  it('keeps the in-memory language usable when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => { throw new Error('storage unavailable') },
    })
    vi.stubGlobal('document', documentStub())
    const mounted = renderI18n()
    expect(mounted.current().locale).toBe('fr')
    act(() => mounted.current().setLocale('en'))
    expect(mounted.current().locale).toBe('en')
  })

  it('formats numbers, dates, and plurals for the selected locale', () => {
    const { storage } = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('document', documentStub())
    const mounted = renderI18n()
    const sampleDate = new Date('2026-01-02T12:00:00Z')
    const frenchDate = mounted.current().formatDate(sampleDate, { dateStyle: 'short', timeZone: 'UTC' })

    expect(mounted.current().formatNumber(1234)).toContain('234')
    expect(mounted.current().formatDate('invalid')).toBe('Date invalide')
    expect(mounted.current().plural('common.count.file.one', 'common.count.file.other', 2)).toBe('2 fichiers')
    act(() => mounted.current().setLocale('en'))
    expect(mounted.current().formatNumber(1234)).toBe('1,234')
    expect(mounted.current().formatDate('invalid')).toBe('Invalid date')
    expect(mounted.current().plural('common.count.file.one', 'common.count.file.other', 2)).toBe('2 files')
    expect(mounted.current().formatDate(sampleDate, { dateStyle: 'short', timeZone: 'UTC' })).not.toBe(frenchDate)
  })

  it('uses one bilingual description for the static PWA manifest', () => {
    expect(PWA_MANIFEST_DESCRIPTION).toContain('Envoie tes fichiers et dossiers')
    expect(PWA_MANIFEST_DESCRIPTION).toContain('Send files and folders')
    expect(PWA_MANIFEST_DESCRIPTION.indexOf('Envoie')).toBeLessThan(PWA_MANIFEST_DESCRIPTION.indexOf('Send'))
    expect(PWA_MANIFEST_LOCALE).toBe('fr')
  })
})
