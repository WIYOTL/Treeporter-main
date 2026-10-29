import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../useAuth'

const { clearTokenMock, loadTokenMock, saveTokenMock } = vi.hoisted(() => ({
  clearTokenMock: vi.fn(),
  loadTokenMock: vi.fn(),
  saveTokenMock: vi.fn(),
}))

vi.mock('../../services/tokenStore', () => ({
  clearToken: clearTokenMock,
  loadToken: loadTokenMock,
  saveToken: saveTokenMock,
}))

const CLASSIC_TEST_TOKEN = 'ghp_test_classic_pat_not_a_secret'
const FINE_GRAINED_TEST_TOKEN = 'github_pat_test_fine_grained_not_a_secret'
const UNKNOWN_FORMAT_TEST_TOKEN = 'mock_pat_with_unrecognized_format'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    headers: { get: () => null },
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

function mountAuth() {
  let auth!: ReturnType<typeof useAuth>
  let renderer!: ReactTestRenderer
  const setScreen = vi.fn()

  function HookProbe() {
    auth = useAuth(setScreen)
    return null
  }

  act(() => {
    renderer = create(createElement(HookProbe))
  })

  return {
    current: () => auth,
    setScreen,
    unmount: () => act(() => renderer.unmount()),
  }
}

const mountedHooks: Array<ReturnType<typeof mountAuth>> = []

function renderAuth() {
  const mounted = mountAuth()
  mountedHooks.push(mounted)
  return mounted
}

async function flushSessionResume() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  loadTokenMock.mockResolvedValue(null)
  saveTokenMock.mockResolvedValue(undefined)
  clearTokenMock.mockResolvedValue(undefined)
})

afterEach(() => {
  mountedHooks.splice(0).forEach(({ unmount }) => unmount())
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useAuth PAT compatibility', () => {
  it.each([
    ['Classic PAT', CLASSIC_TEST_TOKEN, 'classic'],
    ['fine-grained PAT', FINE_GRAINED_TEST_TOKEN, 'fine-grained'],
    ['unrecognized PAT format', UNKNOWN_FORMAT_TEST_TOKEN, 'inconnu'],
  ] as const)('connects a valid %s without using type detection as a gate', async (_label, token, detectedType) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ login: 'test-user' }))
    vi.stubGlobal('fetch', fetchMock)
    const auth = renderAuth()

    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      await auth.current().handleConnect(token)
    })

    expect(auth.current().tokenType).toBe(detectedType)
    expect(auth.current().providerRef.current).not.toBeNull()
    expect(auth.current().connectError).toBeNull()
    expect(auth.setScreen).toHaveBeenCalledWith('dock')
    expect(saveTokenMock).toHaveBeenCalledWith(token)
    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/user', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
    }))
  })

  it('reports a rejected credential without exposing its value', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ message: 'Bad credentials' }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const auth = renderAuth()

    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      await auth.current().handleConnect(FINE_GRAINED_TEST_TOKEN)
    })

    expect(auth.current().connectError).toEqual({ key: 'errors.authenticationFailed', detail: 'Bad credentials' })
    expect(auth.current().providerRef.current).toBeNull()
    expect(saveTokenMock).not.toHaveBeenCalled()
    expect(JSON.stringify(auth.current().connectError)).not.toContain(FINE_GRAINED_TEST_TOKEN)
  })

  it('explains a rejected saved PAT after clearing it and does not offer an impossible retry', async () => {
    loadTokenMock.mockResolvedValueOnce(FINE_GRAINED_TEST_TOKEN)
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ message: 'Bad credentials' }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const auth = renderAuth()

    await flushSessionResume()

    expect(clearTokenMock).toHaveBeenCalledOnce()
    expect(auth.current().sessionError).toEqual({ key: 'errors.savedSessionRejected' })
    expect(auth.current().sessionRetryAvailable).toBe(false)
    expect(auth.current().providerRef.current).toBeNull()
  })

  it('clears a stale resume error when a new PAT connects manually', async () => {
    loadTokenMock.mockResolvedValueOnce(FINE_GRAINED_TEST_TOKEN)
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse({ login: 'test-user' }))
    vi.stubGlobal('fetch', fetchMock)
    const auth = renderAuth()

    await flushSessionResume()
    expect(auth.current().sessionError).toEqual({ key: 'errors.network' })
    expect(auth.current().sessionRetryAvailable).toBe(true)

    await act(async () => {
      await auth.current().handleConnect(CLASSIC_TEST_TOKEN)
    })
    expect(auth.current().sessionError).toBeNull()
    expect(auth.current().sessionRetryAvailable).toBe(false)
    expect(auth.current().connectError).toBeNull()
  })

  it('clears a pending session error and retry state on disconnect', async () => {
    loadTokenMock.mockResolvedValueOnce(FINE_GRAINED_TEST_TOKEN)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('offline')))
    const auth = renderAuth()

    await flushSessionResume()
    expect(auth.current().sessionError).toEqual({ key: 'errors.network' })
    expect(auth.current().sessionRetryAvailable).toBe(true)

    await act(async () => {
      await auth.current().disconnectAuth()
    })
    expect(auth.current().sessionError).toBeNull()
    expect(auth.current().connectError).toBeNull()
    expect(auth.current().sessionRetryAvailable).toBe(false)
  })
})
