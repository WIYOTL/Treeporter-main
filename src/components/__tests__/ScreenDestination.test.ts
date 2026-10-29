import { createElement } from 'react'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RepoRef, Destination } from '../../types'
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../i18n/I18nProvider'
import { ScreenDestination } from '../ScreenDestination'

type ScreenDestinationProps = ComponentProps<typeof ScreenDestination>

const repo: RepoRef = {
  owner: 'test-owner',
  name: 'test-repo',
  fullName: 'test-owner/test-repo',
  defaultBranch: 'main',
}

const destination: Destination = {
  repo: null,
  branch: null,
  targetPath: '',
  commitMessage: 'Test commit',
}

function renderScreen(overrides: Partial<ScreenDestinationProps> = {}, locale: 'fr' | 'en' = 'fr') {
  const props = {
    repos: [],
    branches: [],
    loadingRepos: false,
    reposLoaded: true,
    repositoryLoadError: null,
    loadingBranches: false,
    emptyRepo: false,
    branchError: null,
    destination,
    onSelectRepo: () => {},
    loadRepos: async () => {},
    onRetryBranches: async () => {},
    onChange: () => {},
    onBack: () => {},
    onContinue: () => {},
    ...overrides,
  }

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => key === LOCALE_STORAGE_KEY ? locale : null,
    setItem: () => {},
  })
  return renderToStaticMarkup(createElement(I18nProvider, null, createElement(ScreenDestination, props)))
}

afterEach(() => vi.unstubAllGlobals())

describe('ScreenDestination localization', () => {
  it('shows a repository error and retry in English instead of the empty state', () => {
    const html = renderScreen({
      reposLoaded: false,
      repositoryLoadError: { key: 'errors.network', detail: 'Failed to fetch' },
    }, 'en')

    expect(html).toContain('Could not connect.')
    expect(html).toContain('Technical detail: Failed to fetch')
    expect(html).toContain('Retry')
    expect(html).not.toContain('No repositories are accessible')
  })

  it('shows a branch error and retry without showing the empty repository state', () => {
    const html = renderScreen({
      destination: { ...destination, repo },
      branchError: { key: 'errors.network', detail: 'Failed to fetch' },
    }, 'en')

    expect(html).toContain('Could not connect.')
    expect(html).toContain('Technical detail: Failed to fetch')
    expect(html).toContain('Retry')
    expect(html).not.toContain('This repository is empty')
  })

  it('shows the empty repository notice only after a successful empty response', () => {
    const html = renderScreen({ destination: { ...destination, repo }, emptyRepo: true }, 'en')

    expect(html).toContain('This repository is empty')
    expect(html).not.toContain('Could not load this repository’s branches')
  })

  it('renders repository error, empty, and loading states in French', () => {
    const error = renderScreen({ repositoryLoadError: { key: 'errors.repositoryLoad' } })
    const empty = renderScreen({ repos: [], reposLoaded: true })
    const loading = renderScreen({ loadingRepos: true, reposLoaded: false })

    expect(error).toContain('Impossible de charger les dépôts.')
    expect(empty).toContain('Aucun dépôt accessible avec ce compte.')
    expect(loading).toContain('Chargement des dépôts…')
  })

  it('renders branch loading, empty, and error states in English', () => {
    const selectedDestination = { ...destination, repo }
    const error = renderScreen({ destination: selectedDestination, branchError: { key: 'errors.branchLoad' } }, 'en')
    const loading = renderScreen({ destination: selectedDestination, loadingBranches: true }, 'en')
    const empty = renderScreen({ destination: selectedDestination, branches: [], emptyRepo: true }, 'en')

    expect(error).toContain('Could not load this repository’s branches.')
    expect(error).toContain('Retry')
    expect(loading).toContain('Loading branches…')
    expect(empty).toContain('This repository is empty')
  })
})
