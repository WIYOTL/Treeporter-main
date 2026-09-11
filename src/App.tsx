import { useEffect, useState } from 'react'
import type { ScreenId } from './types'
import { GitHubClient } from './services/github'
import { DemoClient } from './services/demo'
import { loadToken } from './services/tokenStore'
import { TOKEN_TYPE_LABEL, TOKEN_TYPE_BADGE } from './services/tokenType'
import { addHistoryEntry, getHistory } from './services/history'
import type { HistoryEntry } from './services/history'

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

const FLOW_SCREENS: ScreenId[] = ['dock', 'destination', 'preview', 'sending']

// Dérive un titre de PR propre à partir du message de commit : première ligne seulement
// (un message de commit peut être multi-lignes), plafonnée en longueur, avec un repli
// sensé si le message est vide ou ne contient que des espaces.
function derivePullRequestTitle(commitMessage: string, branchName: string): string {
  const firstLine = commitMessage.split('\n')[0].trim()
  if (!firstLine) return `Fusionner ${branchName}`
  return firstLine.length > 100 ? `${firstLine.slice(0, 97)}…` : firstLine
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('connect')
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => getHistory())
  const [prLoading, setPrLoading] = useState(false)
  const [prError, setPrError] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)
  const [branchWasCreated, setBranchWasCreated] = useState(false)

  const auth = useAuth(setScreen)
  const dock = useDock()
  const conflicts = useConflicts(auth.providerRef)
  const destination = useDestination(auth.providerRef, conflicts.resetConflicts)
  const transfer = useTransfer(auth.providerRef)
  const pwaUpdate = usePwaUpdate()

  // Une mise à jour de l'app peut être détectée à tout moment, mais ne doit jamais recharger
  // la page pendant un envoi en cours (les fichiers en mémoire seraient perdus). On l'applique
  // dès que l'écran n'est plus "sending".
  useEffect(() => {
    if (pwaUpdate.updateReady && screen !== 'sending') {
      pwaUpdate.applyUpdateNow()
    }
  }, [pwaUpdate.updateReady, screen])

  async function goToDestination() {
    setScreen('destination')
    await destination.loadReposIfNeeded()
  }

  async function goToPreview() {
    setScreen('preview')
    await conflicts.checkConflicts(destination.destination, dock.files)
  }

  async function handleSend() {
    setScreen('sending')
    setPrUrl(null)
    setPrError(null)
    const branchWasNew = destination.destination.branch?.isNew === true
    const res = await transfer.runCommit(
      destination.destination,
      dock.files,
      conflicts.conflictChoices,
      conflicts.existingPaths
    )
    if (res) {
      setScreen('result')
      setBranchWasCreated(branchWasNew)
      // La branche existe désormais réellement sur GitHub : les envois suivants doivent
      // la traiter comme existante, pas tenter de la recréer (voir markBranchCreated).
      if (branchWasNew) destination.markBranchCreated()
      recordHistory(res)
    }
  }

  async function handleSendRetry() {
    const branchWasNew = destination.destination.branch?.isNew === true
    const res = await transfer.handleRetry(
      destination.destination,
      dock.files,
      conflicts.conflictChoices,
      conflicts.existingPaths
    )
    if (res) {
      setScreen('result')
      setBranchWasCreated(branchWasNew)
      if (branchWasNew) destination.markBranchCreated()
      recordHistory(res)
    }
  }

  function recordHistory(res: { filesSent: number; commitUrl: string }) {
    if (!destination.destination.repo || !destination.destination.branch) return
    addHistoryEntry({
      repoFullName: destination.destination.repo.fullName,
      branchName: destination.destination.branch.name,
      filesSent: res.filesSent,
      commitUrl: res.commitUrl,
      demo: auth.demo,
    })
    setHistoryEntries(getHistory())
  }

  async function handleCreatePullRequest() {
    if (!auth.providerRef.current || !destination.destination.repo || !destination.destination.branch) return
    setPrLoading(true)
    setPrError(null)
    try {
      const pr = await auth.providerRef.current.createPullRequest(
        destination.destination.repo,
        destination.destination.branch,
        derivePullRequestTitle(destination.destination.commitMessage, destination.destination.branch.name)
      )
      setPrUrl(pr.url)
    } catch (err) {
      setPrError(err instanceof Error ? err.message : 'Impossible de créer la Pull Request.')
    } finally {
      setPrLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Déconnecter ce compte GitHub ? Le token enregistré sur cet iPhone sera effacé.')) return
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
      // Nouvelle instance = cache de blobs remis à zéro, pour éviter qu'il ne grossisse
      // indéfiniment au fil des envois d'une même session.
      const stored = await loadToken()
      if (stored) auth.providerRef.current = new GitHubClient(stored)
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
        <div className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="p-dim">Reprise de la session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-title-row">
          <div className="app-mark" />
          <div>
            <div className="app-title">Treeport</div>
            <div className="app-subtitle" style={{ marginTop: 0 }}>
              iPhone → GitHub
            </div>
          </div>
          {auth.demo && screen !== 'connect' && (
            <span className="demo-badge" style={{ marginLeft: 'auto' }}>Démo</span>
          )}
          {!auth.demo && screen !== 'connect' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {auth.tokenType && (
                <span className="mono-chip" title={TOKEN_TYPE_LABEL[auth.tokenType]}>
                  {TOKEN_TYPE_BADGE[auth.tokenType]}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleDisconnect}>
                Déconnecter
              </button>
            </div>
          )}
        </div>
        {flowIndex >= 0 && <StepBar current={flowIndex} />}
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
            onDismissOverwriteNotice={dock.dismissOverwriteNotice}
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
            loadingBranches={destination.loadingBranches}
            destination={destination.destination}
            onSelectRepo={destination.selectRepo}
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
            conflictCheckError={conflicts.conflictCheckError}
            conflictChoices={conflicts.conflictChoices}
            onSetConflictChoice={conflicts.setConflictChoice}
            onApplyBulkConflictChoice={conflicts.applyBulkConflictChoice}
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
          />
        )}

        {screen === 'result' && transfer.result && (
          <ScreenResult
            result={transfer.result}
            destination={destination.destination}
            demo={auth.demo}
            onNewTransfer={handleNewTransfer}
            previousHistory={historyEntries.slice(1)}
            onCreatePullRequest={handleCreatePullRequest}
            prLoading={prLoading}
            prError={prError}
            prUrl={prUrl}
            branchWasCreated={branchWasCreated}
          />
        )}
      </div>
    </div>
  )
}
