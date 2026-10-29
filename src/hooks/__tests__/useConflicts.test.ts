import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitProvider } from '../../services/gitProvider'
import { useConflicts } from '../useConflicts'
import type { Destination, DockedFile } from '../../types'

function mount(provider: GitProvider) {
  const providerRef = { current: provider }
  const state: { current: ReturnType<typeof useConflicts> | null } = { current: null }
  let renderer: ReturnType<typeof create>
  function HookProbe() {
    state.current = useConflicts(providerRef as any)
    return null
  }
  act(() => {
    renderer = create(createElement(HookProbe))
  })
  function sync() {
    act(() => {
      renderer.update(createElement(HookProbe))
    })
  }
  return { get current() { return state.current! }, providerRef, sync }
}

const destination: Destination = {
  repo: { owner: 'o', name: 'r', fullName: 'o/r', defaultBranch: 'main' } as any,
  branch: { name: 'main', isNew: false } as any,
} as any

describe('useConflicts conflict check errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records a conflict check error without claiming files are conflict-free', async () => {
    const provider = {
      listExistingPaths: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as GitProvider
    const m = mount(provider)

    await act(async () => {
      await m.current.checkConflicts(destination, [] as DockedFile[])
    })
    m.sync()

    expect(m.current.existingPaths).toBeNull()
    expect(m.current.conflictCheckError).toEqual({
      key: 'errors.conflictCheck',
      related: { key: 'errors.conflictCheck', detail: 'boom' },
    })
  })

  it('clears the conflict check error on a successful check', async () => {
    const provider = {
      listExistingPaths: vi.fn().mockResolvedValue(new Set(['a.txt'])),
    } as unknown as GitProvider
    const m = mount(provider)

    await act(async () => {
      await m.current.checkConflicts(destination, [] as DockedFile[])
    })
    m.sync()

    expect(m.current.existingPaths).toEqual(new Set(['a.txt']))
    expect(m.current.conflictCheckError).toBeNull()
  })
})
