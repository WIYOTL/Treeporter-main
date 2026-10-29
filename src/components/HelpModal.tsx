import { useI18n } from '../i18n/I18nProvider'
import type { MessageDescriptor } from '../i18n/message'

interface Props {
  open: boolean
  onClose: () => void
}

const sections: { key: string; values?: Record<string, string | number> }[] = [
  {
    key: 'help.github.title',
    values: undefined,
  },
  {
    key: 'help.demo.title',
    values: undefined,
  },
  {
    key: 'help.destination.title',
    values: undefined,
  },
  {
    key: 'help.conflicts.title',
    values: undefined,
  },
  {
    key: 'help.pullRequest.title',
    values: undefined,
  },
]

const sectionBodies: { key: string; values?: Record<string, string | number> }[] = [
  {
    key: 'help.github.body',
    values: undefined,
  },
  {
    key: 'help.demo.body',
    values: undefined,
  },
  {
    key: 'help.destination.body',
    values: undefined,
  },
  {
    key: 'help.conflicts.body',
    values: undefined,
  },
  {
    key: 'help.pullRequest.body',
    values: undefined,
  },
]

const faq: { key: string; values?: Record<string, string | number>; answerKey: string }[] = [
  {
    key: 'help.faq.selection.question',
    answerKey: 'help.faq.selection.answer',
  },
  {
    key: 'help.faq.iphone.question',
    answerKey: 'help.faq.iphone.answer',
  },
  {
    key: 'help.faq.empty.question',
    answerKey: 'help.faq.empty.answer',
  },
]

export function HelpModal({ open, onClose }: Props) {
  if (!open) {
    return null
  }

  const { t, formatMessage } = useI18n()

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="credits-modal-header">
          <div>
            <div
              className="section-label"
              style={{ margin: 0 }}
            >
              {t('help.guide')}
            </div>

            <h2 id="help-title">{t('help.title')}</h2>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label={t('help.close')}
          >
            {t('common.close')}
          </button>
        </div>

        <div className="help-content">
          {sections.map((section, index) => (
            <section
              key={section.key}
              className="help-section"
            >
              <h3>{t(section.key as any)}</h3>
              <p>{formatMessage({ key: sectionBodies[index].key as any })}</p>
            </section>
          ))}

          <section className="help-section">
            <h3>{t('help.faq')}</h3>

            <div className="help-faq">
              {faq.map((item) => (
                <details key={item.key}>
                  <summary>{t(item.key as any)}</summary>
                  <p>{formatMessage({ key: item.answerKey as any })}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
