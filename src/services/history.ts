// Historique local des derniers envois réussis (dépôt, branche, nombre de fichiers, date,
// lien du commit). Purement informatif — n'influence jamais un envoi, ne contient aucun
// token. Stocké en localStorage (petite quantité de données textuelles, pas besoin d'IndexedDB).

export interface HistoryEntry {
  id: string
  repoFullName: string
  branchName: string
  filesSent: number
  commitUrl: string
  demo: boolean
  /** Timestamp ISO — affiché formaté, jamais réutilisé pour une logique métier. */
  at: string
}

const STORAGE_KEY = 'treeporter:history'
const MAX_ENTRIES = 10

function readAll(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota dépassé ou navigation privée : l'historique est un confort, pas une fonctionnalité
    // critique — on n'interrompt jamais un envoi pour ça.
  }
}

export function getHistory(): HistoryEntry[] {
  return readAll()
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'at'>): void {
  const full: HistoryEntry = {
    ...entry,
    id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
  }
  const updated = [full, ...readAll()].slice(0, MAX_ENTRIES)
  writeAll(updated)
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // rien à faire si indisponible
  }
}
