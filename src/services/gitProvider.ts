import type { DockedFile, RepoRef, BranchRef, UploadStep, UploadItem, SendResult } from '../types'

export interface CommitPlan {
  repo: RepoRef
  branch: BranchRef
  targetPath: string
  commitMessage: string
  files: DockedFile[]
}

export interface CommitCallbacks {
  onSteps: (steps: UploadStep[]) => void
  onItems: (items: UploadItem[]) => void
}

export interface PullRequestResult {
  url: string
  number: number
}

/** Interface commune : implémentée par le client GitHub réel et par le client de démo. */
export interface GitProvider {
  validateToken(): Promise<{ login: string }>
  listRepos(): Promise<RepoRef[]>
  listBranches(repo: RepoRef): Promise<string[]>
  /** Chemins déjà présents dans le dépôt/branche cible, pour détecter les conflits avant envoi.
   *  Retourne un ensemble vide si la branche n'a pas encore de commit (dépôt/branche neuve). */
  listExistingPaths(repo: RepoRef, branch: BranchRef): Promise<Set<string>>
  commit(plan: CommitPlan, callbacks: CommitCallbacks, onlyItemIds?: string[]): Promise<SendResult>
  /** Crée une Pull Request de `branch` vers la branche par défaut du dépôt. */
  createPullRequest(repo: RepoRef, branch: BranchRef, title: string): Promise<PullRequestResult>
}

export class GitDockError extends Error {
  constructor(message: string, public cause?: unknown, public status?: number) {
    super(message)
    this.name = 'GitDockError'
  }
}
