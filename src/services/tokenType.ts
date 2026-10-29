// Détection du type de token GitHub à partir de son préfixe (purement côté client,
// ne change rien au mécanisme d'authentification — sert uniquement à afficher une
// information claire et à adapter les messages d'erreur).
import type { MessageKey } from '../i18n/messages'

export type TokenType = 'classic' | 'fine-grained' | 'oauth' | 'app' | 'inconnu'

export function detectTokenType(token: string): TokenType {
  const t = token.trim()
  if (t.startsWith('github_pat_')) return 'fine-grained'
  if (t.startsWith('ghp_')) return 'classic'
  if (t.startsWith('gho_')) return 'oauth'
  if (t.startsWith('ghu_') || t.startsWith('ghs_')) return 'app'
  return 'inconnu'
}

export const TOKEN_TYPE_LABEL: Record<TokenType, MessageKey> = {
  classic: 'token.classic.label',
  'fine-grained': 'token.fineGrained.label',
  oauth: 'token.oauth.label',
  app: 'token.app.label',
  inconnu: 'token.unknown.label',
}

// Libellés courts pour le badge affiché dans la barre du haut (le libellé long ci-dessus
// reste disponible en info-bulle via title=).
export const TOKEN_TYPE_BADGE: Record<TokenType, MessageKey> = {
  classic: 'token.classic.badge',
  'fine-grained': 'token.fineGrained.badge',
  oauth: 'token.oauth.badge',
  app: 'token.app.badge',
  inconnu: 'token.unknown.badge',
}
