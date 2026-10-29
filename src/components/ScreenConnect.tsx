import { useState } from 'react'
import type { MessageDescriptor } from '../i18n/message'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  onConnect: (token: string) => void
  onDemo: () => void
  onRetrySession: () => void
  loading: boolean
  error: MessageDescriptor | null
  sessionError: MessageDescriptor | null
  sessionRetryAvailable: boolean
}

export function ScreenConnect({ onConnect, onDemo, onRetrySession, loading, error, sessionError, sessionRetryAvailable }: Props) {
  const [token, setToken] = useState('')
  const { t, formatMessage } = useI18n()

  return (
    <div>
      <div className="app-mark" style={{ width: 44, height: 44, marginBottom: 14 }} />
      <div className="h1">{t('connect.title')}</div>
      <p className="p-dim">{t('connect.intro')}</p>

      {sessionError && (
        <>
          <div className="banner banner-error" style={{ marginTop: 16, marginBottom: 4 }}>
            {formatMessage(sessionError)}
          </div>
          {sessionRetryAvailable && (
            <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onRetrySession} disabled={loading}>
              {loading ? t('connect.sessionRetryLoading') : t('connect.sessionRetry')}
            </button>
          )}
        </>
      )}

      <div className="field" style={{ marginTop: 20 }}>
        <label>{t('connect.tokenLabel')}</label>
        <input
          type="password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('connect.tokenPlaceholder')}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="field-hint">
          {t('connect.classicInstructions')}
        </div>
        <div className="field-hint" style={{ marginTop: 6 }}>
          {t('connect.fineGrainedInstructions')}
        </div>
      </div>

      {error && <div className="banner banner-error">{formatMessage(error)}</div>}

      <button className="btn btn-primary" disabled={!token || loading} onClick={() => onConnect(token)}>
        {loading ? t('connect.verifying') : t('connect.submit')}
      </button>

      <div style={{ height: 10 }} />

      <button className="btn btn-secondary" onClick={onDemo} disabled={loading}>
        {t('connect.demoButton')}
      </button>
      <div className="field-hint" style={{ marginTop: 8, textAlign: 'center' }}>
        {t('connect.demoDescription')}
      </div>
    </div>
  )
}
