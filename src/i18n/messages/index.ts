import en from './en'
import fr from './fr'

export const messages = { fr, en }

export type Locale = keyof typeof messages
export type MessageKey = keyof typeof fr
