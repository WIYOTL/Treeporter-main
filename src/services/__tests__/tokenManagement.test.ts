import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../github'
import { detectTokenType } from '../tokenType'

const CLASSIC_TEST_TOKEN = 'ghp_test_classic_pat_not_a_secret'
const FINE_GRAINED_TEST_TOKEN = 'github_pat_test_fine_grained_not_a_secret'

function jsonResponse(body: unknown, status = 200, responseHeaders: Record<string, string> = {}): Response {
  const statusText = ({
    200: 'OK',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
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

describe('Token Management - Classic vs Fine-grained PATs', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Classic PAT (ghp_*)', () => {
    it('should accept a valid Classic PAT and return user info', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ login: 'test-user' }))

      const client = new GitHubClient(CLASSIC_TEST_TOKEN)
      const result = await client.validateToken()

      expect(result).toEqual({ login: 'test-user' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${CLASSIC_TEST_TOKEN}`,
          }),
        })
      )
    })

    it('should detect Classic PAT type correctly', () => {
      expect(detectTokenType(CLASSIC_TEST_TOKEN)).toBe('classic')
    })

    it('should reject invalid Classic PAT with 401 and return authenticationFailed error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Bad credentials' }, 401))

      const client = new GitHubClient(CLASSIC_TEST_TOKEN)
      const error = await client.validateToken().catch((e) => e)

      expect(error).toMatchObject({
        name: 'GitDockError',
        status: 401,
        userMessage: { key: 'errors.authenticationFailed' },
      })
      expect(error.message).not.toContain(CLASSIC_TEST_TOKEN)
    })

    it('should handle Classic PAT with insufficient permissions (403) and return scopes error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'Resource not accessible' },
        403,
        { 'x-accepted-oauth-scopes': 'repo' }
      ))

      const client = new GitHubClient(CLASSIC_TEST_TOKEN)
      const error = await client.listRepos().catch((e) => e)

      expect(error).toMatchObject({
        status: 403,
        userMessage: { key: 'errors.classicScopesRequired', values: { scopes: 'repo' } },
      })
    })

    it('should handle Classic PAT with resource not found (404) and return classicNotFoundHint error', async () => {
      // No permission headers to test the fallback to token type-specific hints
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'Not Found' },
        404
      ))

      const client = new GitHubClient(CLASSIC_TEST_TOKEN)
      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
        fullName: 'test-owner/test-repo',
        defaultBranch: 'main',
      }
      const error = await client.listBranches(repo).catch((e) => e)

      expect(error).toMatchObject({
        status: 404,
        userMessage: { key: 'errors.classicNotFoundHint', values: { scopes: 'repo (private repositories) or public_repo (public repositories)' } },
      })
    })

    it('should handle Classic PAT with rate limit (403) and return rateLimitWait error', async () => {
      // Use a future timestamp for x-ratelimit-reset (current time + 60 seconds)
      const futureReset = Math.floor(Date.now() / 1000) + 60
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'API rate limit exceeded' },
        403,
        { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(futureReset) }
      ))

      const client = new GitHubClient(CLASSIC_TEST_TOKEN)
      const error = await client.listRepos().catch((e) => e)

      expect(error.userMessage.key).toBe('errors.rateLimitWait')
      expect(error.userMessage.values.seconds).toBeGreaterThanOrEqual(59)
      expect(error.userMessage.values.seconds).toBeLessThanOrEqual(61)
    })
  })

  describe('Fine-grained PAT (github_pat_*)', () => {
    it('should accept a valid Fine-grained PAT and return user info', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ login: 'test-user' }))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const result = await client.validateToken()

      expect(result).toEqual({ login: 'test-user' })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FINE_GRAINED_TEST_TOKEN}`,
          }),
        })
      )
    })

    it('should detect Fine-grained PAT type correctly', () => {
      expect(detectTokenType(FINE_GRAINED_TEST_TOKEN)).toBe('fine-grained')
    })

    it('should reject invalid Fine-grained PAT with 401 and return authenticationFailed error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Bad credentials' }, 401))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const error = await client.validateToken().catch((e) => e)

      expect(error).toMatchObject({
        name: 'GitDockError',
        status: 401,
        userMessage: { key: 'errors.authenticationFailed' },
      })
      expect(error.message).not.toContain(FINE_GRAINED_TEST_TOKEN)
    })

    it('should handle Fine-grained PAT with insufficient permissions (403) and return permissions error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'Resource not accessible by personal access token' },
        403,
        { 'x-accepted-github-permissions': 'contents=read, pull_requests=write' }
      ))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const error = await client.listRepos().catch((e) => e)

      expect(error).toMatchObject({
        status: 403,
        userMessage: {
          key: 'errors.permissionsRequired',
          values: { permissions: 'contents=read, pull_requests=write' },
        },
      })
    })

    it('should handle Fine-grained PAT with resource not found (404) and return fineGrainedNotFoundHint error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'Not Found' },
        404,
        { 'x-accepted-github-permissions': 'metadata=read' }
      ))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
        fullName: 'test-owner/test-repo',
        defaultBranch: 'main',
      }
      const error = await client.listBranches(repo).catch((e) => e)

      expect(error).toMatchObject({
        status: 404,
        userMessage: {
          key: 'errors.permissionsRequired',
          values: { permissions: 'metadata=read' },
        },
      })
    })

    it('should handle Fine-grained PAT with resource not found (404) and no permission header (CORS issue) and return fineGrainedNotFoundHint with route-specific hint', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const repo = {
        owner: 'test-owner',
        name: 'test-repo',
        fullName: 'test-owner/test-repo',
        defaultBranch: 'main',
      }
      const error = await client.listBranches(repo).catch((e) => e)

      expect(error).toMatchObject({
        status: 404,
        userMessage: {
          key: 'errors.fineGrainedNotFoundHint',
          values: { permissions: 'Contents: read' },
        },
      })
    })

    it('should handle Fine-grained PAT with rate limit (403) and return rateLimitWait error', async () => {
      // Use a future timestamp for x-ratelimit-reset (current time + 60 seconds)
      const futureReset = Math.floor(Date.now() / 1000) + 60
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'API rate limit exceeded' },
        403,
        { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(futureReset) }
      ))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const error = await client.listRepos().catch((e) => e)

      expect(error.userMessage.key).toBe('errors.rateLimitWait')
      expect(error.userMessage.values.seconds).toBeGreaterThanOrEqual(59)
      expect(error.userMessage.values.seconds).toBeLessThanOrEqual(61)
    })

    it('should handle Fine-grained PAT with SSO required (403) and return ssoRequired error', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(
        { message: 'Resource protected by organization SAML enforcement' },
        403,
        { 'x-github-sso': 'required; url=https://github.com/orgs/test-org/sso' }
      ))

      const client = new GitHubClient(FINE_GRAINED_TEST_TOKEN)
      const error = await client.listRepos().catch((e) => e)

      expect(error).toMatchObject({
        status: 403,
        userMessage: { key: 'errors.ssoRequired' },
      })
    })
  })

  describe('Token type detection edge cases', () => {
    it.each([
      ['Classic PAT with spaces', '  ghp_test  ', 'classic'],
      ['Fine-grained PAT with spaces', '  github_pat_test  ', 'fine-grained'],
      ['OAuth token', 'gho_test', 'oauth'],
      ['GitHub App token (user)', 'ghu_test', 'app'],
      ['GitHub App token (server)', 'ghs_test', 'app'],
      ['Unknown format', 'unknown_test', 'inconnu'],
    ])('should detect %s correctly', (_label, token, expectedType) => {
      expect(detectTokenType(token)).toBe(expectedType)
    })
  })
})
