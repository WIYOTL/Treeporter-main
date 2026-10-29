import { LanguageSwitcher } from './LanguageSwitcher'
import { useI18n } from '../i18n/I18nProvider'

interface Props {
  onCredits: () => void
  onHelp: () => void
}

export function AppFooter({
  onCredits,
  onHelp,
}: Props) {
  const { t } = useI18n()

  return (
    <footer className="app-footer">
      <div className="app-footer-meta">
        <span>Treeporter v2.1.0</span>
        <span>Développé par Wiyotl</span>
        <span>© 2026 Wiyotl. Tous droits réservés.</span>
      </div>

      <nav
        className="app-footer-links"
        aria-label="Pied de page"
      >
        <div className="language-switcher-container">
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          className="app-footer-link"
          onClick={onCredits}
        >
          {t('footer.credits')}
        </button>

        <button
          type="button"
          className="app-footer-link"
          onClick={onHelp}
        >
          {t('footer.help')}
        </button>

        <a
          className="app-footer-link"
          href="https://github.com/WIYOTL/Treeporter"
          target="_blank"
          rel="noreferrer"
        >
          {t('footer.github')}
        </a>

        <a
          className="app-footer-link"
          href="https://www.instagram.com/wiyotl/"
          target="_blank"
          rel="noreferrer"
        >
          {t('footer.instagram')}
        </a>

        <a
          className="app-footer-link"
          href="https://dev.to/wiyotl"
          target="_blank"
          rel="noreferrer"
        >
          {t('footer.dev')}
        </a>
      </nav>
    </footer>
  )
}
