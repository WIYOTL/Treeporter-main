// Détection du type de token GitHub à partir de son préfixe (purement côté client,
// ne change rien au mécanisme d'authentification — sert uniquement à afficher une
// information claire et à adapter les messages d'erreur).

export type TokenType = 'classic' | 'fine-grained' | 'oauth' | 'app' | 'inconnu'

export function detectTokenType(token: string): TokenType {
  const t = token.trim()
  if (t.startsWith('github_pat_')) return 'fine-grained'
  if (t.startsWith('ghp_')) return 'classic'
  if (t.startsWith('gho_')) return 'oauth'
  if (t.startsWith('ghu_') || t.startsWith('ghs_')) return 'app'
  return 'inconnu'
}

export const TOKEN_TYPE_LABEL: Record<TokenType, string> = {
  classic: 'Personal access token (classic)',
  'fine-grained': 'Fine-grained personal access token',
  oauth: 'Token OAuth',
  app: 'Token GitHub App',
  inconnu: 'Type de token non reconnu',
}

// Libellés courts pour le badge affiché dans la barre du haut (le libellé long ci-dessus
// reste disponible en info-bulle via title=).
export const TOKEN_TYPE_BADGE: Record<TokenType, string> = {
  classic: 'Classic',
  'fine-grained': 'Fine-grained',
  oauth: 'OAuth',
  app: 'GitHub App',
  inconnu: 'Type inconnu',
}
