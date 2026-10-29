import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitProvider } from '../../services/gitProvider'
import type { RepoRef } from '../../types'
import { I18nProvider, LOCALE_STORAGE_KEY, useI18n } from '../../i18n/I18nProvider'
import { useDestination } from '../useDestination'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

const firstRepo: RepoRef = {
  owner: 'test-owner',
  name: 'first-repo',
  fullName: 'test-owner/first-repo',
  defaultBranch: 'main',
}

const secondRepo: RepoRef = {
  owner: 'test-owner',
  name: 'second-repo',
  fullName: 'test-owner/second-repo',
  defaultBranch: 'trunk',
}

function mockProvider() {
  return {
    listRepos: vi.fn<GitProvider['listRepos']>(),
    listBranches: vi.fn<GitProvider['listBranches']>(),
  }
}

function mountDestination(provider: ReturnType<typeof mockProvider>, locale: 'fr' | 'en' = 'fr') {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => key === LOCALE_STORAGE_KEY ? locale : null,
    setItem: () => {},
  })
  const providerRef = { current: provider as unknown as GitProvider }
  const onBranchChanged = vi.fn()
  let current!: ReturnType<typeof useDestination>
  let setLocale!: ReturnType<typeof useI18n>['setLocale']
  let renderer!: ReactTestRenderer

  function HookProbe() {
    setLocale = useI18n().setLocale
    current = useDestination(providerRef, onBranchChanged)
    return null
  }

  act(() => {
    renderer = create(createElement(I18nProvider, null, createElement(HookProbe)))
  })

  return {
    current: () => current,
    setLocale: (next: 'fr' | 'en') => setLocale(next),
    onBranchChanged,
    unmount: () => act(() => renderer.unmount()),
  }
}

const mountedHooks: Array<ReturnType<typeof mountDestination>> = []

function renderDestination(provider = mockProvider()) {
  const mounted = mountDestination(provider)
  mountedHooks.push(mounted)
  return { ...mounted, provider }
}

afterEach(() => {
  mountedHooks.splice(0).forEach(({ unmount }) => unmount())
  vi.unstubAllGlobals()
})

describe('useDestination asynchronous loading', () => {
  it('keeps only the branch response for the most recently selected repository', async () => {
    const firstBranches = deferred<string[]>()
    const secondBranches = deferred<string[]>()
    const { current, provider } = renderDestination()
    provider.listBranches
      .mockReturnValueOnce(firstBranches.promise)
      .mockReturnValueOnce(secondBranches.promise)

    let firstSelection!: Promise<void>
    let secondSelection!: Promise<void>
    act(() => {
      firstSelection = current().selectRepo(firstRepo)
    })
    act(() => {
      secondSelection = current().selectRepo(secondRepo)
    })

    await act(async () => {
      secondBranches.resolve(['trunk', 'release'])
      await secondSelection
    })
    expect(current().destination.repo?.fullName).toBe(secondRepo.fullName)
    expect(current().branches).toEqual(['trunk', 'release'])

    await act(async () => {
      firstBranches.resolve(['stale-branch'])
      await firstSelection
    })
    expect(current().destination.repo?.fullName).toBe(secondRepo.fullName)
    expect(current().branches).toEqual(['trunk', 'release'])
    expect(current().branchesLoaded).toBe(true)
    expect(current().branchLoadError).toBeNull()
  })

  it('does not restore branch state when a pending request resolves after disconnect reset', async () => {
    const pendingBranches = deferred<string[]>()
    const { current, provider } = renderDestination()
    provider.listBranches.mockReturnValueOnce(pendingBranches.promise)

    let selection!: Promise<void>
    act(() => {
      selection = current().selectRepo(firstRepo)
    })
    act(() => {
      current().resetDestination()
    })

    expect(current().destination.repo).toBeNull()
    expect(current().branches).toEqual([])
    expect(current().loadingBranches).toBe(false)

    await act(async () => {
      pendingBranches.resolve(['stale-branch'])
      await selection
    })

    expect(current().destination.repo).toBeNull()
    expect(current().branches).toEqual([])
    expect(current().branchesLoaded).toBe(false)
    expect(current().loadingBranches).toBe(false)
    expect(current().branchLoadError).toBeNull()
  })

  it('clears a branch error and displays branches after a successful retry', async () => {
    const { current, provider } = renderDestination()
    provider.listBranches
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(['main', 'release'])

    await act(async () => {
      await current().selectRepo(firstRepo)
    })
    expect(current().branchLoadError).toEqual({ key: 'errors.branchLoad', detail: 'Network unavailable' })
    expect(current().branches).toEqual([])
    expect(current().branchesLoaded).toBe(false)

    await act(async () => {
      await current().retryBranches()
    })
    expect(current().branchLoadError).toBeNull()
    expect(current().branches).toEqual(['main', 'release'])
    expect(current().branchesLoaded).toBe(true)
  })

  it('clears a repository error and displays repositories after a successful retry', async () => {
    const { current, provider } = renderDestination()
    provider.listRepos
      .mockRejectedValueOnce(Object.assign(new Error('HTTP failure'), { status: 503 }))
      .mockResolvedValueOnce([firstRepo])

    await act(async () => {
      await current().loadReposIfNeeded()
    })
    expect(current().repositoryLoadError).toEqual({ key: 'errors.repositoryLoad', detail: 'HTTP failure' })
    expect(current().repos).toEqual([])
    expect(current().reposLoaded).toBe(false)

    await act(async () => {
      await current().loadReposIfNeeded()
    })
    expect(current().repositoryLoadError).toBeNull()
    expect(current().repos).toEqual([firstRepo])
    expect(current().reposLoaded).toBe(true)
  })

  it('keeps successful empty repository and branch responses distinct from failures', async () => {
    const { current, provider } = renderDestination()
    provider.listRepos
      .mockRejectedValueOnce(Object.assign(new Error('HTTP failure'), { status: 403 }))
      .mockResolvedValueOnce([])
    provider.listBranches
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce([])

    await act(async () => {
      await current().loadReposIfNeeded()
    })
    expect(current().repositoryLoadError).toEqual({ key: 'errors.repositoryLoad', detail: 'HTTP failure' })
    expect(current().reposLoaded).toBe(false)

    await act(async () => {
      await current().loadReposIfNeeded()
    })
    expect(current().repositoryLoadError).toBeNull()
    expect(current().repos).toEqual([])
    expect(current().reposLoaded).toBe(true)

    await act(async () => {
      await current().selectRepo(firstRepo)
    })
    expect(current().branchLoadError).toEqual({ key: 'errors.branchLoad', detail: 'Network unavailable' })
    expect(current().branchesLoaded).toBe(false)

    await act(async () => {
      await current().retryBranches()
    })
    expect(current().branchLoadError).toBeNull()
    expect(current().branches).toEqual([])
    expect(current().branchesLoaded).toBe(true)
  })

  it('localizes the untouched default commit message while preserving user-entered text', () => {
    const mounted = mountDestination(mockProvider(), 'en')
    mountedHooks.push(mounted)
    const { current, setLocale } = mounted
    expect(current().destination.commitMessage).toBe('Added from iPhone (Treeport)')

    act(() => setLocale('fr'))
    expect(current().destination.commitMessage).toBe('Ajout depuis iPhone (Treeport)')
    act(() => current().updateDestination({ commitMessage: 'Keep this exact message' }))
    act(() => setLocale('en'))
    expect(current().destination.commitMessage).toBe('Keep this exact message')
  })
})
