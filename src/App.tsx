import { useEffect, useState } from 'react'
import type { ScreenId } from './types'

import { GitHubClient } from './services/github'
import { DemoClient } from './services/demo'
import { loadToken } from './services/tokenStore'
import {
  TOKEN_TYPE_LABEL,
  TOKEN_TYPE_BADGE,
} from './services/tokenType'
import {
  addHistoryEntry,
  getHistory,
} from './services/history'
import type { HistoryEntry } from './services/history'
import { getTargetPathError, checkTransferLimits, getTransferLimitError } from './services/fileTree'

import { useAuth } from './hooks/useAuth'
import { useDock } from './hooks/useDock'
import { useDestination } from './hooks/useDestination'
import { useConflicts } from './hooks/useConflicts'
import { useTransfer } from './hooks/useTransfer'
import { usePwaUpdate } from './hooks/usePwaUpdate'

import { StepBar } from './components/StepBar'
import { ScreenConnect } from './components/ScreenConnect'
import { ScreenDock } from './components/ScreenDock'
import { ScreenDestination } from './components/ScreenDestination'
import { ScreenPreview } from './components/ScreenPreview'
import { ScreenSending } from './components/ScreenSending'
import { ScreenResult } from './components/ScreenResult'
import { AppFooter } from './components/AppFooter'
import { CreditsModal } from './components/CreditsModal'
import { HelpModal } from './components/HelpModal'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { useI18n } from './i18n/I18nProvider'
import { messageFromError } from './i18n/message'
import type { MessageDescriptor } from './i18n/message'
import type { MessageKey } from './i18n/messages'

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string

const FLOW_SCREENS: ScreenId[] = [
  'dock',
  'destination',
  'preview',
  'sending',
]

function derivePullRequestTitle(
  commitMessage: string,
  branchName: string,
  t: Translate
): string {
  const firstLine = commitMessage.split('\n')[0].trim()

  if (!firstLine) {
    return t('result.defaultPullRequestTitle', { branch: branchName })
  }

  return firstLine.length > 100
    ? `${firstLine.slice(0, 97)}…`
    : firstLine
}

export default function App() {
  const { t, locale, setLocale } = useI18n()
  const [screen, setScreen] = useState<ScreenId>('connect')
  const [historyEntries, setHistoryEntries] = useState<
    HistoryEntry[]
  >(() => getHistory())

  const [prLoading, setPrLoading] = useState(false)
  const [prError, setPrError] = useState<MessageDescriptor | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)
  const [branchWasCreated, setBranchWasCreated] =
    useState(false)

  const [creditsOpen, setCreditsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const auth = useAuth(setScreen)
  const dock = useDock()
  const conflicts = useConflicts(auth.providerRef)

  const destination = useDestination(
    auth.providerRef,
    conflicts.resetConflicts
  )

  const transfer = useTransfer(auth.providerRef)
  const pwaUpdate = usePwaUpdate()

  useEffect(() => {
    if (!creditsOpen && !helpOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      setCreditsOpen(false)
      setHelpOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [creditsOpen, helpOpen])

  useEffect(() => {
    if (
      pwaUpdate.updateReady &&
      screen !== 'sending'
    ) {
      pwaUpdate.applyUpdateNow()
    }
  }, [
    pwaUpdate.updateReady,
    pwaUpdate.applyUpdateNow,
    screen,
  ])

  async function goToDestination() {
    setScreen('destination')
    await destination.loadReposIfNeeded()
  }

  async function goToPreview() {
    const targetPathError = getTargetPathError(
      destination.destination.targetPath
    )

    if (targetPathError) {
      return
    }

    // Vérifier les limites de transfert avant de continuer
    const limitError = getTransferLimitError(dock.files)
    if (limitError) {
      // Afficher une alerte avec le message d'erreur
      window.alert(t(limitError.key, limitError.values))
      return
    }

    setScreen('preview')

    await conflicts.checkConflicts(
      destination.destination,
      dock.files
    )
  }

  async function handleSend() {
    if (
      conflicts.conflictLoading ||
      conflicts.conflictCheckError ||
      conflicts.existingPaths === null
    ) {
      return
    }

    setScreen('sending')
    setPrUrl(null)
    setPrError(null)

    const branchWasNew =
      destination.destination.branch?.isNew === true

    const result = await transfer.runCommit(
      destination.destination,
      dock.files,
      conflicts.conflictChoices,
      conflicts.existingPaths
    )

    if (!result) {
      return
    }

    setScreen('result')
    setBranchWasCreated(branchWasNew)

    if (branchWasNew) {
      destination.markBranchCreated()
    }

    recordHistory(result)
  }

  async function handleSendRetry() {
    const branchWasNew =
      destination.destination.branch?.isNew === true

    const result = await transfer.handleRetry(
      destination.destination,
      dock.files,
      conflicts.conflictChoices,
      conflicts.existingPaths
    )

    if (!result) {
      return
    }

    setScreen('result')
    setBranchWasCreated(branchWasNew)

    if (branchWasNew) {
      destination.markBranchCreated()
    }

    recordHistory(result)
  }

  function recordHistory(result: {
    filesSent: number
    commitUrl: string
  }) {
    if (
      !destination.destination.repo ||
      !destination.destination.branch
    ) {
      return
    }

    addHistoryEntry({
      repoFullName:
        destination.destination.repo.fullName,
      branchName:
        destination.destination.branch.name,
      filesSent: result.filesSent,
      commitUrl: result.commitUrl,
      demo: auth.demo,
    })

    setHistoryEntries(getHistory())
  }

  async function handleCreatePullRequest() {
    if (
      !auth.providerRef.current ||
      !destination.destination.repo ||
      !destination.destination.branch
    ) {
      return
    }

    setPrLoading(true)
    setPrError(null)

    try {
      const pullRequest =
        await auth.providerRef.current.createPullRequest(
          destination.destination.repo,
          destination.destination.branch,
          derivePullRequestTitle(
            destination.destination.commitMessage,
            destination.destination.branch.name,
            t
          )
        )

      setPrUrl(pullRequest.url)
    } catch (error) {
      setPrError(messageFromError(error, 'errors.pullRequest'))
    } finally {
      setPrLoading(false)
    }
  }

  async function handleDisconnect() {
    const confirmed = window.confirm(
      t('app.disconnectConfirm')
    )

    if (!confirmed) {
      return
    }

    await auth.disconnectAuth()
    dock.resetDock()
    destination.resetDestination()
    transfer.resetTransfer()
    conflicts.resetConflicts()

    setPrUrl(null)
    setPrError(null)
    setBranchWasCreated(false)
    setScreen('connect')
  }

  async function handleNewTransfer() {
    if (auth.demo) {
      auth.providerRef.current = new DemoClient()
    } else {
      const storedToken = await loadToken()

      if (storedToken) {
        auth.providerRef.current = new GitHubClient(storedToken)
      }
    }

    dock.resetDock()
    transfer.resetTransfer()
    conflicts.resetConflicts()
    destination.resetDestinationKeepingTarget()

    setPrUrl(null)
    setPrError(null)
    setBranchWasCreated(false)
    setScreen('dock')
  }

  const flowIndex = FLOW_SCREENS.indexOf(screen)

  if (auth.sessionLoading) {
    return (
      <div className="app-shell">
        <div
          className="app-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p className="p-dim">{t('app.resumeSession')}</p>
        </div>

        <AppFooter
          onCredits={() => setCreditsOpen(true)}
          onHelp={() => setHelpOpen(true)}
        />

        <CreditsModal
          open={creditsOpen}
          onClose={() => setCreditsOpen(false)}
        />

        <HelpModal
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-title-row">
          <div className="app-mark" />

          <div>
            <div className="app-title">Treeporter</div>

            <div
              className="app-subtitle"
              style={{ marginTop: 0 }}
            >
              {t('app.subtitle')}
            </div>
          </div>

          {auth.demo && screen !== 'connect' && (
            <span
              className="demo-badge"
              style={{ marginLeft: 'auto' }}
            >
              {t('app.demo')}
            </span>
          )}

          {!auth.demo && screen !== 'connect' && (
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {auth.tokenType && (
                <span
                  className="mono-chip"
                  title={t(TOKEN_TYPE_LABEL[auth.tokenType])}
                >
                  {t(TOKEN_TYPE_BADGE[auth.tokenType])}
                </span>
              )}
              <div className="language-switcher-container">
                <span className="language-switcher-label">{t('language.switcherLabel')} :</span>
                <LanguageSwitcher />
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleDisconnect}
              >
                {t('app.disconnect')}
              </button>
            </div>
          )}
        </div>

        {flowIndex >= 0 && (
          <StepBar current={flowIndex} />
        )}
      </div>

      <div className="app-content">
        {screen === 'connect' && (
          <ScreenConnect
            onConnect={auth.handleConnect}
            onDemo={auth.handleDemo}
            onRetrySession={auth.handleRetrySession}
            loading={auth.connectLoading}
            error={auth.connectError}
            sessionError={auth.sessionError}
            sessionRetryAvailable={auth.sessionRetryAvailable}
          />
        )}

        {screen === 'dock' && (
          <ScreenDock
            files={dock.files}
            onAdd={dock.handleAdd}
            onAddZip={dock.handleAddZip}
            onRemove={dock.handleRemove}
            onClear={dock.handleClearWithConfirm}
            onContinue={goToDestination}
            overwriteNotice={dock.overwriteNotice}
            onDismissOverwriteNotice={
              dock.dismissOverwriteNotice
            }
            zipLoading={dock.zipLoading}
            zipError={dock.zipError}
            onDismissZipError={dock.dismissZipError}
          />
        )}

        {screen === 'destination' && (
          <ScreenDestination
            repos={destination.repos}
            branches={destination.branches}
            loadingRepos={destination.loadingRepos}
            reposLoaded={destination.reposLoaded}
            repositoryLoadError={destination.repositoryLoadError}
            loadingBranches={destination.loadingBranches}
            emptyRepo={
              Boolean(
                destination.destination.repo &&
                  destination.branchesLoaded &&
                  destination.branches.length === 0 &&
                  !destination.loadingBranches &&
                  !destination.branchLoadError
              )
            }
            branchError={destination.branchLoadError}
            destination={destination.destination}
            onSelectRepo={destination.selectRepo}
            loadRepos={destination.loadReposIfNeeded}
            onRetryBranches={destination.retryBranches}
            onChange={destination.updateDestination}
            onBack={() => setScreen('dock')}
            onContinue={goToPreview}
          />
        )}

        {screen === 'preview' && (
          <ScreenPreview
            files={dock.files}
            destination={destination.destination}
            onToggleExclude={dock.handleToggleExclude}
            onBack={() => setScreen('destination')}
            onSend={handleSend}
            existingPaths={conflicts.existingPaths}
            conflictLoading={conflicts.conflictLoading}
            conflictCheckError={
              conflicts.conflictCheckError
            }
            conflictChoices={conflicts.conflictChoices}
            onSetConflictChoice={
              conflicts.setConflictChoice
            }
            onApplyBulkConflictChoice={
              conflicts.applyBulkConflictChoice
            }
          />
        )}

        {screen === 'sending' && (
          <ScreenSending
            steps={transfer.steps}
            items={transfer.items}
            incomplete={transfer.incomplete}
            fatalError={transfer.fatalError}
            onRetry={handleSendRetry}
            onBackToPreview={() => setScreen('preview')}
            updatePending={pwaUpdate.updateReady}
            currentBatch={transfer.currentBatch}
            totalBatches={transfer.totalBatches}
          />
        )}

        {screen === 'result' && transfer.result && (
          <ScreenResult
            result={transfer.result}
            destination={destination.destination}
            demo={auth.demo}
            onNewTransfer={handleNewTransfer}
            previousHistory={historyEntries.slice(1)}
            onCreatePullRequest={
              handleCreatePullRequest
            }
            prLoading={prLoading}
            prError={prError}
            prUrl={prUrl}
            branchWasCreated={branchWasCreated}
          />
        )}
      </div>

      <AppFooter
        onCredits={() => setCreditsOpen(true)}
        onHelp={() => setHelpOpen(true)}
      />

      <CreditsModal
        open={creditsOpen}
        onClose={() => setCreditsOpen(false)}
      />

      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  )
}
