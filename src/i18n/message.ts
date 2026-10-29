import type { MessageKey } from './messages'

export type MessageValues = Record<string, string | number>

export interface MessageDescriptor {
  key: MessageKey
  values?: MessageValues
  /** Untranslated technical details from an API or browser error. */
  detail?: string
  related?: MessageDescriptor
}

export type LocalizedMessage = string | MessageDescriptor

export function messageFromError(error: unknown, fallback: MessageKey): MessageDescriptor {
  const userMessage = error && typeof error === 'object'
    ? (error as { userMessage?: unknown }).userMessage
    : undefined
  if (isMessageDescriptor(userMessage)) return userMessage
  const detail = error instanceof Error && error.message && error.message !== 'INCOMPLETE'
    ? error.message
    : undefined
  return { key: fallback, detail }
}

export function isMessageDescriptor(value: unknown): value is MessageDescriptor {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'key' in value &&
      typeof (value as { key?: unknown }).key === 'string'
  )
}

export class MessageError extends Error {
  constructor(public userMessage: MessageDescriptor) {
    super('Localized application error')
    this.name = 'MessageError'
  }
}
