import type { Locale } from './messages'
import { messages } from './messages'

/** A manifest is a single static file, so its description is intentionally bilingual. */
export const PWA_MANIFEST_LOCALE: Locale = 'fr'
export const PWA_MANIFEST_DESCRIPTION = `${messages.fr['meta.description']} / ${messages.en['meta.description']}`

export function localizedDescription(locale: Locale): string {
  return messages[locale]['meta.description']
}
