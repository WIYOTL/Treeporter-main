import { createElement } from 'react'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScreenConnect } from '../../components/ScreenConnect'
import { ScreenDock } from '../../components/ScreenDock'
import { ScreenPreview } from '../../components/ScreenPreview'
import { ScreenSending } from '../../components/ScreenSending'
import { ScreenResult } from '../../components/ScreenResult'
import { HelpModal } from '../../components/HelpModal'
import { CreditsModal } from '../../components/CreditsModal'
import { I18nProvider, LOCALE_STORAGE_KEY } from '../I18nProvider'
import type { Destination } from '../../types'

const destination: Destination = {
  repo: { owner: 'test', name: 'tree', fullName: 'test/tree', defaultBranch: 'main' },
  branch: { name: 'main', isNew: false },
  targetPath: '',
  commitMessage: 'Add files',
}

function markup(locale: 'fr' | 'en', element: React.ReactNode) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => key === LOCALE_STORAGE_KEY ? locale : null,
    setItem: () => {},
  })
  return renderToStaticMarkup(createElement(I18nProvider, null, element))
}

afterEach(() => vi.unstubAllGlobals())

describe('localized screens', () => {
  it('renders connection guidance and errors in both languages', () => {
    const props = {
      onConnect: () => {}, onDemo: () => {}, onRetrySession: () => {}, loading: false,
      error: { key: 'errors.authenticationFailed' } as const, sessionError: null,
      sessionRetryAvailable: false,
    }
    const french = markup('fr', createElement(ScreenConnect, props))
    const english = markup('en', createElement(ScreenConnect, props))

    expect(french).toContain('Connecte GitHub')
    expect(french).toContain('GitHub n’a pas authentifié cette requête.')
    expect(french).toContain('Paramètres de développeur')
    expect(french).toContain('public_repo')
    expect(french).toContain('Metadata: read')
    expect(french).toContain('Workflows: Read and write')
    expect(french).toContain('un seul propriétaire')
    expect(french).toContain('envoyé directement à l’API GitHub')
    expect(english).toContain('Connect to GitHub')
    expect(english).toContain('GitHub did not authenticate this request.')
    expect(english).toContain('Developer settings')
    expect(english).toContain('Fine-grained tokens')
    expect(english).toContain('public_repo')
    expect(english).toContain('Metadata: read')
    expect(english).toContain('Workflows: Read and write')
    expect(english).toContain('one owner')
    expect(english).toContain('sent directly to the GitHub API')

    const permissionError = { key: 'errors.permissionsRequired', values: { permissions: 'contents=write' } } as const
    const frenchPermission = markup('fr', createElement(ScreenConnect, { ...props, error: permissionError }))
    const englishPermission = markup('en', createElement(ScreenConnect, { ...props, error: permissionError }))
    expect(frenchPermission).toContain('permissions Fine-grained requises : contents=write')
    expect(englishPermission).toContain('fine-grained permissions: contents=write')

    const classicScopeError = { key: 'errors.classicScopesRequired', values: { scopes: 'repo' } } as const
    expect(markup('fr', createElement(ScreenConnect, { ...props, error: classicScopeError }))).toContain('scopes Classic vérifiés par cet endpoint : repo')
    expect(markup('en', createElement(ScreenConnect, { ...props, error: classicScopeError }))).toContain('Classic scopes this endpoint checks: repo')

    const fineGrainedHint = {
      key: 'errors.fineGrainedPermissionHint', values: { permissions: 'Contents: read' },
    } as const
    expect(markup('fr', createElement(ScreenConnect, { ...props, error: fineGrainedHint })))
      .toContain('vérifie la permission Contents: read, les dépôts sélectionnés dans le jeton')
    expect(markup('en', createElement(ScreenConnect, { ...props, error: fineGrainedHint })))
      .toContain('check the Contents: read permission, the repositories selected for the token')

    const rateLimitError = { key: 'errors.rateLimitWait', values: { seconds: 37 } } as const
    expect(markup('fr', createElement(ScreenConnect, { ...props, error: rateLimitError }))).toContain('Attends au moins 37 secondes')
    expect(markup('en', createElement(ScreenConnect, { ...props, error: rateLimitError }))).toContain('Wait at least 37 seconds')
  })

  it('shows a rejected saved session without offering to retry the deleted token', () => {
    const props = {
      onConnect: () => {}, onDemo: () => {}, onRetrySession: () => {}, loading: false,
      error: null, sessionError: { key: 'errors.savedSessionRejected' } as const,
      sessionRetryAvailable: false,
    }
    const french = markup('fr', createElement(ScreenConnect, props))
    const english = markup('en', createElement(ScreenConnect, props))

    expect(french).toContain('GitHub a refusé le PAT enregistré.')
    expect(french).not.toContain('Réessayer avec la session enregistrée')
    expect(english).toContain('GitHub rejected the saved PAT.')
    expect(english).not.toContain('Retry with the saved session')

    const retryable = markup('en', createElement(ScreenConnect, {
      ...props,
      sessionError: { key: 'errors.sessionVerification' },
      sessionRetryAvailable: true,
    }))
    expect(retryable).toContain('Retry with the saved session')
  })

  it('renders transfer area empty states and archive errors in both languages', () => {
    const props = {
      files: [], onAdd: () => {}, onAddZip: () => {}, onRemove: () => {}, onClear: () => {}, onContinue: () => {},
      overwriteNotice: null, onDismissOverwriteNotice: () => {}, zipLoading: false,
      zipError: { key: 'dock.zipUnreadable', values: { filename: 'backup.zip' } } as const, onDismissZipError: () => {},
    }
    const french = markup('fr', createElement(ScreenDock, props))
    const english = markup('en', createElement(ScreenDock, props))

    expect(french).toContain('Zone de transfert')
    expect(french).toContain('Rien pour l&#x27;instant')
    expect(french).toContain('backup.zip')
    expect(english).toContain('Transfer area')
    expect(english).toContain('Nothing here yet')
    expect(english).toContain('Could not read “backup.zip”')
  })

  it('renders preview, conflict, sending, and per-file errors in English', () => {
    const previewProps: ComponentProps<typeof ScreenPreview> = {
      files: [], destination, onToggleExclude: () => {}, onBack: () => {}, onSend: () => {},
      existingPaths: null, conflictLoading: true, conflictCheckError: { key: 'errors.conflictCheck' },
      conflictChoices: new Map(), onSetConflictChoice: () => {}, onApplyBulkConflictChoice: () => {},
    }
    const preview = markup('en', createElement(ScreenPreview, previewProps))
    const previewFr = markup('fr', createElement(ScreenPreview, previewProps))
    const sendingProps: ComponentProps<typeof ScreenSending> = {
      steps: [{ id: 'files', label: 'sending.uploadStep', status: 'uploading' }],
      items: [{ id: 'f1', path: 'folder/file.txt', size: 1, status: 'error', error: { key: 'errors.fileUpload', detail: '403 Forbidden' } }],
      incomplete: false, fatalError: { key: 'errors.network', detail: 'Failed to fetch' },
      onRetry: () => {}, onBackToPreview: () => {},
    }
    const sending = markup('en', createElement(ScreenSending, sendingProps))
    const sendingFr = markup('fr', createElement(ScreenSending, sendingProps))

    expect(preview).toContain('Preview')
    expect(preview).toContain('Checking for files already in the repository')
    expect(preview).toContain('Could not check for conflicts')
    expect(previewFr).toContain('Aperçu')
    expect(previewFr).toContain('Impossible de vérifier les conflits')
    expect(sending).toContain('Uploading')
    expect(sending).toContain('Uploading files')
    expect(sending).toContain('Could not connect')
    expect(sending).toContain('Technical detail: 403 Forbidden')
    expect(sending).toContain('Technical detail: Failed to fetch')
    expect(sendingFr).toContain('Envoi en cours')
    expect(sendingFr).toContain('Connexion impossible')
    expect(sendingFr).toContain('Détail technique : 403 Forbidden')
  })

  it('renders result, pull request errors, help, and credits in English', () => {
    const resultProps: ComponentProps<typeof ScreenResult> = {
      result: { commitSha: 'abc123', commitUrl: 'https://github.com/test/tree/commit/abc123', filesSent: 1, filesFailed: 0, batchCount: 1, currentBatch: 1, totalBatches: 1 },
      destination, demo: false, onNewTransfer: () => {}, previousHistory: [], onCreatePullRequest: () => {},
      prLoading: false, prError: { key: 'errors.pullRequest', detail: '422 Unprocessable Entity' },
      prUrl: null, branchWasCreated: false,
    }
    const result = markup('en', createElement(ScreenResult, resultProps))
    const resultFr = markup('fr', createElement(ScreenResult, resultProps))
    const help = markup('en', createElement(HelpModal, { open: true, onClose: () => {} }))
    const credits = markup('en', createElement(CreditsModal, { open: true, onClose: () => {} }))

    expect(result).toContain('Commit created')
    expect(result).toContain('1 file uploaded to test/tree (main)')
    expect(result).toContain('Could not create the pull request')
    expect(result).toContain('Technical detail: 422 Unprocessable Entity')
    expect(resultFr).toContain('Commit créé')
    expect(resultFr).toContain('Impossible de créer la Pull Request')
    expect(help).toContain('Treeporter help')
    expect(help).toContain('GitHub connection')
    expect(markup('fr', createElement(HelpModal, { open: true, onClose: () => {} }))).toContain('Connexion GitHub')
    expect(credits).toContain('Credits')
    expect(credits).toContain('Created and developed by')
    expect(markup('fr', createElement(CreditsModal, { open: true, onClose: () => {} }))).toContain('Crédits')
  })
})
