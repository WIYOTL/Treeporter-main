// Types partagés de Treeport

export type ScreenId = 'connect' | 'dock' | 'destination' | 'preview' | 'sending' | 'result'

export interface DockedFile {
  id: string
  /** chemin relatif tel que fourni par l'iPhone (dossier conservé ou juste le nom), normalisé en Unicode NFC */
  relativePath: string
  file: File
  size: number
  excluded: boolean
  excludeReason?: string
  /** fichier au-delà du seuil d'avertissement (encodage base64 en mémoire, cf. README) */
  isLarge?: boolean
  /** chemin de remplacement choisi par l'utilisateur en cas de conflit avec un fichier existant */
  renamedPath?: string
}

/** Résolution choisie par l'utilisateur pour un fichier dont le chemin existe déjà dans le dépôt cible. */
export type ConflictResolution = 'replace' | 'ignore' | 'rename'

export interface RepoRef {
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  /** Le token a-t-il les droits d'écriture (push) sur ce dépôt ? Absent = non vérifié. */
  canPush?: boolean
}

export interface BranchRef {
  name: string
  isNew: boolean
}

export type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  path: string
  size: number
  status: FileStatus
  error?: string
  /** Octets déjà envoyés — utile pour les gros fichiers en cours d'upload (status 'uploading'). */
  bytesSent?: number
}

export type UploadStepId = 'files' | 'tree' | 'commit' | 'ref'

export interface UploadStep {
  id: UploadStepId
  label: string
  status: FileStatus
  error?: string
}

export interface SendResult {
  commitSha: string
  commitUrl: string
  filesSent: number
  filesFailed: number
}

export interface Destination {
  repo: RepoRef | null
  branch: BranchRef | null
  targetPath: string
  commitMessage: string
}
