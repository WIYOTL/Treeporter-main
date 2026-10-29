import { useEffect, useRef, useState } from 'react'
import type { ScreenId } from '../types'
import { GitHubClient } from '../services/github'
import { DemoClient } from '../services/demo'
import { GitDockError } from '../services/gitProvider'
import type { GitProvider } from '../services/gitProvider'
import { saveToken, loadToken, clearToken } from '../services/tokenStore'
import { detectTokenType, type TokenType } from '../services/tokenType'
import { messageFromError } from '../i18n/message'
import type { MessageDescriptor } from '../i18n/message'

// Regroupe tout ce qui concerne la session GitHub : connexion, reprise automatique au
// démarrage, type de token détecté, déconnexion. Extrait de App.tsx (V2.0.0) sans changer
// le comportement — voir l'historique du fichier pour la logique d'origine, inchangée ici.
export function useAuth(setScreen: (screen: ScreenId) => void) {
  const providerRef = useRef<GitProvider | null>(null)

  const [demo, setDemo] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<MessageDescriptor | null>(null)
  const [sessionError, setSessionError] = useState<MessageDescriptor | null>(null)
  const [sessionRetryAvailable, setSessionRetryAvailable] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [tokenType, setTokenType] = useState<TokenType | null>(null)

  async function handleConnect(token: string) {
    setConnectLoading(true)
    setConnectError(null)
    setSessionError(null)
    setSessionRetryAvailable(false)
    try {
      const client = new GitHubClient(token)
      await client.validateToken()
      providerRef.current = client
      setDemo(false)
      setTokenType(detectTokenType(token))
      setScreen('dock')
      await saveToken(token)
    } catch (err) {
      setConnectError(messageFromError(err, 'errors.connection'))
    } finally {
      setConnectLoading(false)
    }
  }

  async function tryResumeSession(): Promise<boolean> {
    const stored = await loadToken()
    if (!stored) {
      setSessionError(null)
      setSessionRetryAvailable(false)
      return false
    }
    try {
      const client = new GitHubClient(stored)
      await client.validateToken()
      providerRef.current = client
      setDemo(false)
      setTokenType(detectTokenType(stored))
      setScreen('dock')
      setConnectError(null)
      setSessionError(null)
      setSessionRetryAvailable(false)
      return true
    } catch (err) {
      if (err instanceof GitDockError && err.status === 401) {
        // GitHub n'accepte plus le jeton enregistré : on l'efface et demande une reconnexion.
        await clearToken()
        setConnectError(null)
        setSessionError({ key: 'errors.savedSessionRejected' })
        setSessionRetryAvailable(false)
      } else {
        // Erreur réseau ou autre problème passager : on garde le token enregistré
        // (il sera revalidé à la prochaine tentative) et on informe simplement l'utilisateur.
        setSessionError(messageFromError(err, 'errors.sessionVerification'))
        setSessionRetryAvailable(true)
      }
      return false
    }
  }

  async function handleRetrySession() {
    setConnectLoading(true)
    setConnectError(null)
    await tryResumeSession()
    setConnectLoading(false)
  }

  // Au démarrage, tente de reprendre la session avec un token déjà enregistré
  // sur cet iPhone, pour éviter d'avoir à le recoller à chaque ouverture.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await tryResumeSession()
      if (!cancelled) setSessionLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDemo() {
    providerRef.current = new DemoClient()
    setDemo(true)
    setTokenType(null)
    setConnectError(null)
    setSessionError(null)
    setSessionRetryAvailable(false)
    setScreen('dock')
  }

  /** Efface uniquement l'état lié à l'authentification (token, provider, type détecté).
   *  Ne touche ni à l'écran ni aux autres domaines (fichiers, destination, envoi…) —
   *  c'est à l'appelant (App.tsx) d'orchestrer la réinitialisation complète. */
  async function disconnectAuth() {
    await clearToken()
    providerRef.current = null
    setDemo(false)
    setTokenType(null)
    setConnectError(null)
    setSessionError(null)
    setSessionRetryAvailable(false)
  }

  return {
    providerRef,
    demo,
    tokenType,
    connectLoading,
    connectError,
    sessionError,
    sessionRetryAvailable,
    sessionLoading,
    handleConnect,
    handleDemo,
    handleRetrySession,
    disconnectAuth,
  }
}
