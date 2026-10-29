import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../github'

const CLASSIC_TEST_TOKEN = 'ghp_test_classic_pat_not_a_secret'
const FINE_GRAINED_TEST_TOKEN = 'github_pat_test_fine_grained_not_a_secret'
const UNKNOWN_FORMAT_TEST_TOKEN = 'mock_pat_with_unrecognized_format'

function jsonResponse(body: unknown, status = 200, responseHeaders: Record<string, string> = {}): Response {
  const statusText = ({
    200: 'OK',
    201: 'Created',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
  } as Record<number, string>)[status] ?? 'Error'
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get(name: string) {
        const matchingName = Object.keys(responseHeaders).find((key) => key.toLowerCase() === name.toLowerCase())
        return matchingName ? responseHeaders[matchingName] : null
      },
    },
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

function installMockXhr(responseStatus: number, responseBody: unknown, responseHeaders: Record<string, string> = {}) {
  const requests: Array<{ method: string; url: string; headers: Record<string, string>; body: string }> = []
  class MockXHR {
    upload = {} as XMLHttpRequestUpload
    status = responseStatus
    statusText = responseStatus === 201 ? 'Created' : responseStatus === 403 ? 'Forbidden' : 'Error'
    responseText = JSON.stringify(responseBody)
    onprogress: ((event: ProgressEvent) => void) | null = null
    onerror: (() => void) | null = null
    onload: (() => void) | null = null
    private method = ''
    private url = ''
    private headers: Record<string, string> = {}

    open(method: string, url: string) {
      this.method = method
      this.url = url
    }

    setRequestHeader(name: string, value: string) {
      this.headers[name] = value
    }

    getResponseHeader(name: string) {
      const matchingName = Object.keys(responseHeaders).find((key) => key.toLowerCase() === name.toLowerCase())
      return matchingName ? responseHeaders[matchingName] : null
    }

    send(body: string) {
      requests.push({ method: this.method, url: this.url, headers: this.headers, body })
      this.onload?.()
    }
  }

  vi.stubGlobal('XMLHttpRequest', MockXHR as unknown as typeof XMLHttpRequest)
  return requests
}

describe('GitHubClient repository loading', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and maps repositories across API pages using the mocked response', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      owner: { login: 'test-owner' },
      name: `repo-${index}`,
      full_name: `test-owner/repo-${index}`,
      default_branch: 'main',
      permissions: { push: true },
    }))
    const secondPage = [{
      owner: { login: 'test-owner' },
      name: 'last-repo',
      full_name: 'test-owner/last-repo',
      default_branch: 'trunk',
      permissions: { push: false },
    }]
    fetchMock
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse(secondPage))

    const repos = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos()

    expect(repos).toHaveLength(101)
    expect(repos[0]).toEqual({
      owner: 'test-owner',
      name: 'repo-0',
      fullName: 'test-owner/repo-0',
      defaultBranch: 'main',
      canPush: true,
    })
    expect(repos[100].canPush).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstCall = fetchMock.mock.calls[0]
    const firstUrl = new URL(firstCall[0] as string)
    expect(firstUrl.searchParams.get('page')).toBe('1')
    expect(firstCall[1].headers.Authorization).toBe(`Bearer ${CLASSIC_TEST_TOKEN}`)
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('page')).toBe('2')
  })

  it('preserves a successful empty repository response as an empty list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).resolves.toEqual([])
  })

  it('loads repositories returned for a fine-grained PAT without requiring a classic prefix', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{
      owner: { login: 'test-owner' },
      name: 'selected-repo',
      full_name: 'test-owner/selected-repo',
      default_branch: 'main',
      permissions: { push: true },
    }]))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).resolves.toMatchObject([
      { fullName: 'test-owner/selected-repo', canPush: true },
    ])
  })

  it('does not claim the account is read-only when GitHub omits its permissions field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{
      owner: { login: 'test-owner' },
      name: 'repo-with-unknown-role',
      full_name: 'test-owner/repo-with-unknown-role',
      default_branch: 'main',
    }]))

    const [repo] = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()

    expect(repo.canPush).toBeUndefined()
  })

  it('surfaces an HTTP failure when loading repositories instead of returning an empty list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, 403))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      name: 'GitDockError',
      status: 403,
      userMessage: { key: 'errors.fineGrainedPermissionHint', values: { permissions: 'Metadata: read' } },
    })
  })

  it('does not describe a repository or branch as missing when the repository-list endpoint returns 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      status: 404,
      userMessage: { key: 'errors.githubRequest', detail: 'Not Found' },
    })
  })
})

describe('GitHubClient token validation and diagnostics', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['Classic PAT', CLASSIC_TEST_TOKEN],
    ['fine-grained PAT', FINE_GRAINED_TEST_TOKEN],
    ['unrecognized token format', UNKNOWN_FORMAT_TEST_TOKEN],
  ])('validates %s through the same authenticated-user request', async (_label, token) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ login: 'test-user' }))

    await expect(new GitHubClient(token).validateToken()).resolves.toEqual({ login: 'test-user' })

    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/user', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
    }))
  })

  it.each([CLASSIC_TEST_TOKEN, FINE_GRAINED_TEST_TOKEN])('does not use token prefix to classify a 401 (%s)', async (token) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: `${token} was rejected` }, 401))

    const error = await new GitHubClient(token).validateToken().catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      name: 'GitDockError',
      status: 401,
      userMessage: { key: 'errors.authenticationFailed', detail: '[redacted] was rejected' },
    })
    expect((error as Error).message).not.toContain(token)
    expect(JSON.stringify((error as { userMessage: unknown }).userMessage)).not.toContain(token)
  })

  it('reports the fine-grained permissions GitHub says this endpoint accepts', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'Resource not accessible by personal access token' },
      403,
      { 'x-accepted-github-permissions': 'contents=read, pull_requests=write' }
    ))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      status: 403,
      userMessage: {
        key: 'errors.permissionsRequired',
        values: { permissions: 'contents=read, pull_requests=write' },
      },
    })
  })

  it('reports classic scopes separately when GitHub provides the accepted scopes header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'Resource not accessible' },
      403,
      { 'x-accepted-oauth-scopes': 'repo' }
    ))

    await expect(new GitHubClient(CLASSIC_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      status: 403,
      userMessage: { key: 'errors.classicScopesRequired', values: { scopes: 'repo' } },
    })
  })

  it('provides a fine-grained endpoint permission hint when the browser cannot read GitHub’s permission header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Resource not accessible by personal access token' }, 403))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches({
      owner: 'test-owner', name: 'private', fullName: 'test-owner/private', defaultBranch: 'main',
    })).rejects.toMatchObject({
      status: 403,
      userMessage: { key: 'errors.fineGrainedPermissionHint', values: { permissions: 'Contents: read' } },
    })
  })

  it('redacts the token if a response permission header unexpectedly echoes it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'Resource not accessible by personal access token' },
      403,
      { 'x-accepted-github-permissions': `${FINE_GRAINED_TEST_TOKEN}, contents=read` }
    ))

    const error = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)

    expect(JSON.stringify((error as { userMessage: unknown }).userMessage)).not.toContain(FINE_GRAINED_TEST_TOKEN)
    expect((error as { userMessage: { values: { permissions: string } } }).userMessage.values.permissions)
      .toContain('[redacted], contents=read')
  })

  it('keeps a missing or inaccessible repository distinct from invalid authentication', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches({
      owner: 'test-owner', name: 'missing', fullName: 'test-owner/missing', defaultBranch: 'main',
    })).rejects.toMatchObject({
      status: 404,
      userMessage: {
        key: 'errors.fineGrainedNotFoundHint',
        values: { permissions: 'Contents: read' },
      },
    })
  })

  it('uses permission diagnostics for a 404 when GitHub supplies its required permissions', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'Not Found' },
      404,
      { 'x-accepted-github-permissions': 'contents=read' }
    ))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches({
      owner: 'test-owner', name: 'private', fullName: 'test-owner/private', defaultBranch: 'main',
    })).rejects.toMatchObject({
      status: 404,
      userMessage: { key: 'errors.permissionsRequired', values: { permissions: 'contents=read' } },
    })
  })

  it('distinguishes rate limits and includes Retry-After when provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'You have exceeded a secondary rate limit' },
      403,
      { 'retry-after': '37' }
    ))

    await expect(new GitHubClient(CLASSIC_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      status: 403,
      userMessage: { key: 'errors.rateLimitWait', values: { seconds: 37 } },
    })
  })

  it('recognizes a 429 rate limit even without rate-limit headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Too many requests' }, 429))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      status: 429,
      userMessage: { key: 'errors.rateLimit' },
    })
  })

  it('uses the primary rate-limit reset time when Retry-After is absent', async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 90
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'API rate limit exceeded' },
      403,
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetAt) }
    ))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)
    const seconds = (error as { userMessage: { values: { seconds: number } } }).userMessage.values.seconds

    expect(error).toMatchObject({ userMessage: { key: 'errors.rateLimitWait' } })
    expect(seconds).toBeGreaterThanOrEqual(89)
    expect(seconds).toBeLessThanOrEqual(91)
  })

  it('explains a Classic PAT SAML authorization response instead of calling it invalid', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'Resource protected by organization SAML enforcement' },
      403,
      { 'x-github-sso': 'required; url=https://github.com/orgs/test-org/sso' }
    ))

    await expect(new GitHubClient(CLASSIC_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      status: 403,
      userMessage: { key: 'errors.ssoRequired' },
    })
  })

  it('keeps network failures separate from authentication and permission errors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listRepos()).rejects.toMatchObject({
      userMessage: { key: 'errors.network' },
    })
  })
})

describe('GitHubClient branch loading', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const repo = {
    owner: 'test-owner',
    name: 'test-repo',
    fullName: 'test-owner/test-repo',
    defaultBranch: 'main',
  }

  it('loads non-empty branches with a fine-grained PAT', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'main' }, { name: 'release' }]))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches(repo)).resolves.toEqual(['main', 'release'])
  })

  it('returns an empty list only for a successful empty branches response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches(repo)).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/branches?per_page=100&page=1',
      expect.any(Object)
    )
  })

  it('loads all branch pages instead of silently stopping at the first 100', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ name: `branch-${index}` }))
    fetchMock
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse([{ name: 'branch-100' }]))

    const branches = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches(repo)

    expect(branches).toHaveLength(101)
    expect(branches[100]).toBe('branch-100')
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('page')).toBe('1')
    expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('page')).toBe('2')
  })

  it('surfaces an HTTP failure when loading branches', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches(repo)).rejects.toMatchObject({
      name: 'GitDockError',
      status: 404,
    })
  })

  it('surfaces network failures as errors rather than empty branches', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listBranches(repo)).rejects.toMatchObject({
      name: 'GitDockError',
      userMessage: { key: 'errors.network' },
    })
  })
})

describe('GitHubClient conflict checks and pull requests', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const repo = { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo', defaultBranch: 'main' }

  it('loads existing file paths for conflict detection with Contents read access', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ object: { sha: 'tree-sha' } }))
      .mockResolvedValueOnce(jsonResponse({
        tree: [
          { path: 'folder/file.txt', type: 'blob' },
          { path: 'folder', type: 'tree' },
        ],
      }))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listExistingPaths(repo, { name: 'main', isNew: false }))
      .resolves.toEqual(new Set(['folder/file.txt']))
  })

  it('does not treat a 404 for an existing branch as a successful empty conflict scan', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listExistingPaths(
      repo,
      { name: 'main', isNew: false }
    )).rejects.toMatchObject({
      status: 404,
      userMessage: { key: 'errors.fineGrainedNotFoundHint', values: { permissions: 'Contents: read' } },
    })
  })

  it('skips the conflict request for a newly selected branch', async () => {
    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).listExistingPaths(
      repo,
      { name: 'feature', isNew: true }
    )).resolves.toEqual(new Set())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates a pull request through the existing endpoint with the same PAT auth scheme', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ html_url: 'https://github.com/test-owner/test-repo/pull/7', number: 7 }, 201))

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).createPullRequest(
      repo,
      { name: 'feature', isNew: true },
      'Add files'
    )).resolves.toEqual({ url: 'https://github.com/test-owner/test-repo/pull/7', number: 7 })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/pulls',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${FINE_GRAINED_TEST_TOKEN}` }),
        body: JSON.stringify({ title: 'Add files', head: 'feature', base: 'main' }),
      })
    )
  })
})

describe('GitHubClient HTTP error messages (409, 422, 5xx)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    [409, 'Conflict'],
    [422, 'Unprocessable Entity'],
    [500, 'Internal Server Error'],
    [502, 'Bad Gateway'],
    [503, 'Service Unavailable'],
  ])('maps HTTP %s without a body to its dedicated error key', async (status, statusText) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Something went wrong' }, status))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)

    const expectedKey = status === 409 ? 'errors.conflict' : status === 422 ? 'errors.validation' : 'errors.serverError'
    expect(error).toMatchObject({ status, userMessage: { key: expectedKey, detail: 'Something went wrong' } })
    expect(JSON.stringify((error as { userMessage: unknown }).userMessage)).not.toContain(CLASSIC_TEST_TOKEN)
  })

  it('maps a 409 without a body to the conflict key and a neutral technical detail', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 409))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)

    expect(error).toMatchObject({ status: 409, userMessage: { key: 'errors.conflict' } })
  })

  it('maps a 422 without a body to the validation key and a neutral technical detail', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 422))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)

    expect(error).toMatchObject({ status: 422, userMessage: { key: 'errors.validation' } })
  })

  it('maps a 5xx without a body to the server error key and a neutral technical detail', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)

    expect(error).toMatchObject({ status: 500, userMessage: { key: 'errors.serverError' } })
  })

  it('does not claim the repository changed for a 409', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Reference already exists' }, 409))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)
    const message = JSON.stringify((error as { userMessage: { key: string; detail?: string } }).userMessage)

    expect(message).not.toMatch(/chang|modif|changed|modified/i)
    expect(error).toMatchObject({ userMessage: { key: 'errors.conflict', detail: 'Reference already exists' } })
  })

  it('uses the GitHub-provided cause for a 422 when the body is explicit', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: 'Validation failed', errors: [{ field: 'ref', code: 'invalid' }] },
      422,
    ))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      status: 422,
      userMessage: { key: 'errors.validation', detail: 'Validation failed' },
    })
  })

  it('advises retrying later for a 5xx without presenting it as necessarily temporary', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Internal server error' }, 500))

    const error = await new GitHubClient(CLASSIC_TEST_TOKEN).listRepos().catch((reason: unknown) => reason)
    const message = JSON.stringify((error as { userMessage: { key: string; detail?: string } }).userMessage)

    expect(error).toMatchObject({ status: 500, userMessage: { key: 'errors.serverError', detail: 'Internal server error' } })
    expect(message).not.toMatch(/tempor|temporary/i)
  })
})

describe('GitHubClient existing-branch transfer', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the blob, tree, commit, and branch-update upload flow intact with mocked responses', async () => {
    const fetchRoutes = [
      { body: { object: { sha: 'base-commit-sha' } } },
      { body: { tree: { sha: 'base-tree-sha' } } },
      { body: { sha: 'new-tree-sha' } },
      { body: { sha: 'new-commit-sha' } },
      { body: { object: { sha: 'base-commit-sha' } } },
      { body: {} },
    ]
    fetchMock.mockImplementation(async () => jsonResponse(fetchRoutes.shift()?.body ?? {}))

    const xhrRequests = installMockXhr(201, { sha: 'new-blob-sha' })

    const repo = { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo', defaultBranch: 'main' }
    const file = { arrayBuffer: async () => Uint8Array.from([65]).buffer } as File
    const onSteps = vi.fn()
    const onItems = vi.fn()
    const result = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).commit({
      repo,
      branch: { name: 'main', isNew: false },
      targetPath: 'folder',
      commitMessage: 'Add file',
      files: [{ id: 'file-1', relativePath: 'hello.txt', file, size: 1, excluded: false }],
    }, { onSteps, onItems })

    expect(result).toEqual({
      commitSha: 'new-commit-sha',
      commitUrl: 'https://github.com/test-owner/test-repo/commit/new-commit-sha',
      filesSent: 1,
      filesFailed: 0,
      batchCount: 1,
      currentBatch: 1,
      totalBatches: 1,
    })
    expect(xhrRequests).toHaveLength(1)
    expect(xhrRequests[0].method).toBe('POST')
    expect(new URL(xhrRequests[0].url).pathname).toBe('/repos/test-owner/test-repo/git/blobs')
    expect(xhrRequests[0].headers.Authorization).toBe(`Bearer ${FINE_GRAINED_TEST_TOKEN}`)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock.mock.calls.map(([url, init]) => [new URL(url as string).pathname, init?.method ?? 'GET'])).toEqual([
      ['/repos/test-owner/test-repo/git/ref/heads/main', 'GET'],
      ['/repos/test-owner/test-repo/git/commits/base-commit-sha', 'GET'],
      ['/repos/test-owner/test-repo/git/trees', 'POST'],
      ['/repos/test-owner/test-repo/git/commits', 'POST'],
      ['/repos/test-owner/test-repo/git/ref/heads/main', 'GET'],
      ['/repos/test-owner/test-repo/git/refs/heads/main', 'PATCH'],
    ])
    expect(fetchMock.mock.calls.every(([, init]) => init?.headers && (init.headers as Record<string, string>).Authorization === `Bearer ${FINE_GRAINED_TEST_TOKEN}`)).toBe(true)
    expect(onSteps).toHaveBeenCalled()
    expect(onItems).toHaveBeenCalled()
  })

  it('refuses to update an existing branch when its SHA changed during transfer (non-batching)', async () => {
    const fetchRoutes = [
      { body: { object: { sha: 'base-commit-sha' } } },
      { body: { tree: { sha: 'base-tree-sha' } } },
      { body: { sha: 'new-tree-sha' } },
      { body: { sha: 'new-commit-sha' } },
      { body: { object: { sha: 'different-sha' } } }, // branch moved during transfer
    ]
    fetchMock.mockImplementation(async () => jsonResponse(fetchRoutes.shift()?.body ?? {}))

    const xhrRequests = installMockXhr(201, { sha: 'new-blob-sha' })

    const repo = { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo', defaultBranch: 'main' }
    const file = { arrayBuffer: async () => Uint8Array.from([65]).buffer } as File

    const error = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).commit({
      repo,
      branch: { name: 'main', isNew: false },
      targetPath: '',
      commitMessage: 'Add file',
      files: [{ id: 'file-1', relativePath: 'hello.txt', file, size: 1, excluded: false }],
    }, { onSteps: vi.fn(), onItems: vi.fn() }).catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      status: 409,
      userMessage: { key: 'errors.conflict' },
    })
    // No PATCH should have been attempted after the conflict was detected
    const patchCalls = fetchMock.mock.calls.filter(([url]) => new URL(url as string).pathname.endsWith('/refs/heads/main') && (url[1] as RequestInit)?.method === 'PATCH')
    expect(patchCalls).toHaveLength(0)
    // XHR blob upload still happened (5th fetch route was the conflict check, not PATCH)
    expect(xhrRequests).toHaveLength(1)
  })

  it('refuses to update an existing branch when its SHA changed during transfer (batching)', async () => {
    // Forcer le fractionnement en depassant le seuil de 1000 fichiers par commit
    const manyFiles = Array.from({ length: 1001 }, (_, i) => ({
      id: `file-${i}`,
      relativePath: `file-${i}.txt`,
      file: { arrayBuffer: async () => Uint8Array.from([65]).buffer } as File,
      size: 1,
      excluded: false,
    }))

    const fetchRoutes = [
      // Lecture de la ref de base
      { body: { object: { sha: 'base-commit-sha' } } },
      // Creation de la branche temporaire (POST /git/refs)
      { body: {} },
      // Lot 1 (1000 fichiers): lecture du commit de base comme arbre parent
      { body: { tree: { sha: 'base-tree-sha-1' } } },
      { body: { sha: 'new-tree-sha-1' } },
      { body: { sha: 'new-commit-sha-1' } },
      // Lot 2 (1 fichier): lecture du commit precedent comme arbre parent
      { body: { tree: { sha: 'new-tree-sha-1' } } },
      { body: { sha: 'new-tree-sha-2' } },
      { body: { sha: 'new-commit-sha-2' } },
      // Commit de squash
      { body: { sha: 'squash-commit-sha' } },
      // verifyAndPatchRef lit la reference actuelle - branche deplacee
      { body: { object: { sha: 'different-sha' } } },
    ]
    fetchMock.mockImplementation(async () => jsonResponse(fetchRoutes.shift()?.body ?? {}))

    const xhrRequests = installMockXhr(201, { sha: 'new-blob-sha' })

    const repo = { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo', defaultBranch: 'main' }

    const error = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).commit({
      repo,
      branch: { name: 'main', isNew: false },
      targetPath: '',
      commitMessage: 'Add files',
      files: manyFiles,
    }, { onSteps: vi.fn(), onItems: vi.fn(), onBatchProgress: vi.fn() }).catch((reason: unknown) => reason)

    expect(error).toMatchObject({
      status: 409,
      userMessage: { key: 'errors.conflict' },
    })
    // Aucun PATCH ne devrait etre tente apres detection du conflit
    const patchCalls = fetchMock.mock.calls.filter(([url]) => new URL(url as string).pathname.endsWith('/refs/heads/main') && (url[1] as RequestInit)?.method === 'PATCH')
    expect(patchCalls).toHaveLength(0)
    // La suppression de la branche temporaire ne devrait pas etre atteinte non plus
    const deleteCalls = fetchMock.mock.calls.filter(([url]) => new URL(url as string).pathname.endsWith('/refs/heads/main') && (url[1] as RequestInit)?.method === 'DELETE')
    expect(deleteCalls).toHaveLength(0)
  })

  it('creates a new branch without any branch-update conflict check', async () => {
    const fetchRoutes = [
      { body: { object: { sha: 'base-commit-sha' } } },
      { body: { tree: { sha: 'base-tree-sha' } } },
      { body: { sha: 'new-tree-sha' } },
      { body: { sha: 'new-commit-sha' } },
      { body: {} }, // POST /git/refs for new branch creation
    ]
    fetchMock.mockImplementation(async () => jsonResponse(fetchRoutes.shift()?.body ?? {}))

    const xhrRequests = installMockXhr(201, { sha: 'new-blob-sha' })

    const repo = { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo', defaultBranch: 'main' }
    const file = { arrayBuffer: async () => Uint8Array.from([65]).buffer } as File

    const result = await new GitHubClient(FINE_GRAINED_TEST_TOKEN).commit({
      repo,
      branch: { name: 'feature-branch', isNew: true },
      targetPath: '',
      commitMessage: 'Add file',
      files: [{ id: 'file-1', relativePath: 'hello.txt', file, size: 1, excluded: false }],
    }, { onSteps: vi.fn(), onItems: vi.fn() })

    expect(result).toEqual({
      commitSha: 'new-commit-sha',
      commitUrl: 'https://github.com/test-owner/test-repo/commit/new-commit-sha',
      filesSent: 1,
      filesFailed: 0,
      batchCount: 1,
      currentBatch: 1,
      totalBatches: 1,
    })
    // Nouvelle branche : utilisation de POST, jamais de PATCH
    const patchCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH')
    expect(patchCalls).toHaveLength(0)
    // Un appel POST vers /git/refs doit avoir ete effectue
    const refPathnames = fetchMock.mock.calls
      .map(([url]) => new URL(url as string).pathname)
      .filter((p) => p === '/repos/test-owner/test-repo/git/refs')
    expect(refPathnames).toHaveLength(1)
  })

  it('shows permission diagnostics from the XMLHttpRequest blob upload without failing auth', async () => {
    const xhrRequests = installMockXhr(403, { message: 'Resource not accessible by personal access token' }, {
      'x-accepted-github-permissions': 'contents=write',
    })
    const repo = { owner: 'test-owner', name: 'test-repo', fullName: 'test-owner/test-repo', defaultBranch: 'main' }
    const file = { arrayBuffer: async () => Uint8Array.from([65]).buffer } as File
    const onItems = vi.fn()

    await expect(new GitHubClient(FINE_GRAINED_TEST_TOKEN).commit({
      repo,
      branch: { name: 'main', isNew: false },
      targetPath: '',
      commitMessage: 'Add file',
      files: [{ id: 'file-1', relativePath: 'hello.txt', file, size: 1, excluded: false }],
    }, { onSteps: vi.fn(), onItems })).rejects.toMatchObject({ message: 'INCOMPLETE' })

    expect(xhrRequests[0].headers.Authorization).toBe(`Bearer ${FINE_GRAINED_TEST_TOKEN}`)
    const itemCalls = onItems.mock.calls
    expect(itemCalls[itemCalls.length - 1]?.[0][0].error).toEqual({
      key: 'errors.permissionsRequired',
      values: { permissions: 'contents=write' },
      detail: 'Resource not accessible by personal access token',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
