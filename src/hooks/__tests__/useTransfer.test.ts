import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitProvider } from '../../services/gitProvider'
import { useTransfer } from '../useTransfer'
import type { Destination, DockedFile } from '../../types'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const destination: Destination = {
  repo: { owner: 'o', name: 'r', fullName: 'o/r', defaultBranch: 'main' } as any,
  branch: { name: 'main', isNew: false } as any,
  targetPath: '',
  commitMessage: 'msg',
}

function makeProvider(commitPromise: Promise<any>) {
  return { commit: vi.fn(() => commitPromise) } as unknown as GitProvider
}

function mount(commitPromise: Promise<any>) {
  const providerRef = { current: makeProvider(commitPromise) }
  const state: { current: ReturnType<typeof useTransfer> | null } = { current: null }
  let renderer: ReactTestRenderer
  function HookProbe() {
    state.current = useTransfer(providerRef as any)
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

describe('useTransfer concurrency guard', () => {
  it('blocks concurrent runCommit', async () => {
    const d = deferred<any>()
    const { current } = mount(d.promise)
    let p1: Promise<any>
    act(() => {
      p1 = current.runCommit(destination, [], new Map(), null)
    })
    let p2: any
    act(() => {
      p2 = current.runCommit(destination, [], new Map(), null)
    })
    expect(p2).resolves.toBeNull()
    d.resolve({ filesSent: 1, commitSha: 'c', commitUrl: 'u', filesFailed: 0, batchCount: 1, currentBatch: 1, totalBatches: 1 })
    await p1!
  })

  it('allows new run after success', async () => {
    const d = deferred<any>()
    const { current } = mount(d.promise)
    let p1: Promise<any>
    act(() => { p1 = current.runCommit(destination, [], new Map(), null) })
    d.resolve({ filesSent: 1, commitSha: 'c', commitUrl: 'u', filesFailed: 0, batchCount: 1, currentBatch: 1, totalBatches: 1 })
    await p1!
    const d2 = deferred<any>()
    const { current: c2 } = mount(d2.promise)
    let p3: Promise<any>
    act(() => { p3 = c2.runCommit(destination, [], new Map(), null) })
    d2.resolve({ filesSent: 1, commitSha: 'c2', commitUrl: 'u2', filesFailed: 0, batchCount: 1, currentBatch: 1, totalBatches: 1 })
    await expect(p3!).resolves.not.toBeNull()
  })

  it('releases guard after failure', async () => {
    const d = deferred<any>()
    const { current } = mount(d.promise)
    let p1: Promise<any>
    act(() => { p1 = current.runCommit(destination, [], new Map(), null) })
    d.reject(new Error('boom'))
    await p1!
    const d2 = deferred<any>()
    const { current: c2 } = mount(d2.promise)
    let p3: Promise<any>
    act(() => { p3 = c2.runCommit(destination, [], new Map(), null) })
    d2.resolve({ filesSent: 1, commitSha: 'c2', commitUrl: 'u2', filesFailed: 0, batchCount: 1, currentBatch: 1, totalBatches: 1 })
    await expect(p3!).resolves.not.toBeNull()
  })

  it('sets a fatal transfer error preserving the technical detail when the commit fails', async () => {
    const d = deferred<any>()
    const m = mount(d.promise)
    let p1: Promise<any>
    act(() => {
      p1 = m.current.runCommit(destination, [], new Map(), null)
    })
    d.reject(new Error('boom'))
    await act(async () => { await p1! })
    m.sync()
    expect(m.current.fatalError).toEqual({ key: 'errors.transfer', detail: 'boom' })
  })
})
