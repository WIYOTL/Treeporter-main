import { useI18n } from '../i18n/I18nProvider'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreditsModal({ open, onClose }: Props) {
  if (!open) {
    return null
  }

  const { t } = useI18n()

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="credits-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="credits-modal-header">
          <div>
            <div
              className="section-label"
              style={{ margin: 0 }}
            >
              {t('credits.about')}
            </div>

            <h2 id="credits-title">{t('credits.title')}</h2>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label={t('credits.close')}
          >
            {t('common.close')}
          </button>
        </div>

        <p className="credits-description">
          {t('credits.description')}
        </p>

        <div className="credits-list">
          <p>
            <strong>{t('credits.creation')}</strong>
            <span>Wiyotl</span>
          </p>

          <p>
            <strong>{t('credits.brand')}</strong>
            <span>Wiyotl</span>
          </p>

          <p>
            <strong>{t('credits.technology')}</strong>
            <span>
              React, TypeScript, Vite, VitePWA, GitHub API, JSZip
            </span>
          </p>

          <p>
            <strong>{t('credits.version')}</strong>
            <span>2.1.0</span>
          </p>
        </div>
      </div>
    </div>
  )
}
