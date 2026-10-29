import { useI18n } from '../i18n/I18nProvider'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t('language.switcherLabel')}
    >
      <button
        type="button"
        className="app-footer-link language-switcher-option"
        aria-label={t('language.french')}
        aria-pressed={locale === 'fr'}
        onClick={() => setLocale('fr')}
      >
        FR
      </button>
      <button
        type="button"
        className="app-footer-link language-switcher-option"
        aria-label={t('language.english')}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  )
}
