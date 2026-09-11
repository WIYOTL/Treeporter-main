import { useState } from 'react'

interface Props {
  onConnect: (token: string) => void
  onDemo: () => void
  onRetrySession: () => void
  loading: boolean
  error: string | null
  sessionError: string | null
}

export function ScreenConnect({ onConnect, onDemo, onRetrySession, loading, error, sessionError }: Props) {
  const [token, setToken] = useState('')

  return (
    <div>
      <div className="app-mark" style={{ width: 44, height: 44, marginBottom: 14 }} />
      <div className="h1">Connecte GitHub</div>
      <p className="p-dim">
        Colle un token GitHub avec l'accès en écriture au(x) dépôt(s) que tu veux remplir. Un token classique
        (<span style={{ fontFamily: 'var(--font-mono)' }}>ghp_…</span>) est recommandé pour l'instant — voir la
        note ci-dessous pour les tokens fine-grained.
      </p>

      {sessionError && (
        <>
          <div className="banner banner-error" style={{ marginTop: 16, marginBottom: 4 }}>
            {sessionError}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onRetrySession} disabled={loading}>
            {loading ? 'Nouvelle tentative…' : 'Réessayer avec la session enregistrée'}
          </button>
        </>
      )}

      <div className="field" style={{ marginTop: 20 }}>
        <label>Personal Access Token</label>
        <input
          type="password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ghp_••••••••••••"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="field-hint">
          Créé sur github.com → Settings → Developer settings → Personal access tokens → Tokens (classic).
          Scope conseillé : « repo ». Le token reste uniquement sur ton iPhone.
        </div>
        <div className="field-hint" style={{ marginTop: 6 }}>
          Tokens fine-grained (<span style={{ fontFamily: 'var(--font-mono)' }}>github_pat_…</span>) : utilisables,
          mais peuvent renvoyer une erreur d'authentification s'ils ont expiré (obligatoire, 1 an max) ou s'ils ont
          été copiés incomplets (ils sont longs). Vérifie ces deux points avant de recréer un token.
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <button className="btn btn-primary" disabled={!token || loading} onClick={() => onConnect(token)}>
        {loading ? 'Vérification…' : 'Connecter'}
      </button>

      <div style={{ height: 10 }} />

      <button className="btn btn-secondary" onClick={onDemo} disabled={loading}>
        Essayer sans compte GitHub (démo locale)
      </button>
      <div className="field-hint" style={{ marginTop: 8, textAlign: 'center' }}>
        La démo simule un dépôt, des branches et un envoi complet — aucune donnée n'est envoyée sur internet.
      </div>
    </div>
  )
}
