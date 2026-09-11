import type { RepoRef, BranchRef, UploadItem, UploadStep, SendResult } from '../types'
import type { GitProvider, CommitPlan, CommitCallbacks, PullRequestResult } from './gitProvider'
import { GitDockError } from './gitProvider'
import { joinTargetPath } from './fileTree'

// Client de démonstration : simule le comportement de l'API GitHub sans réseau,
// pour tester toute l'interface (y compris les erreurs et le "Réessayer") sans token.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const DEMO_REPOS: RepoRef[] = [
  { owner: 'toi', name: 'mon-app-ios', fullName: 'toi/mon-app-ios', defaultBranch: 'main' },
  { owner: 'toi', name: 'site-portfolio', fullName: 'toi/site-portfolio', defaultBranch: 'main' },
  { owner: 'toi', name: 'jeu-prototype', fullName: 'toi/jeu-prototype', defaultBranch: 'develop' },
]

const DEMO_BRANCHES: Record<string, string[]> = {
  'toi/mon-app-ios': ['main', 'develop', 'feature/upload-ui'],
  'toi/site-portfolio': ['main'],
  'toi/jeu-prototype': ['develop', 'main', 'feature/inventaire'],
}

// Quelques chemins "déjà présents" fictifs, pour pouvoir tester la détection de conflits
// (Remplacer/Ignorer/Renommer) en mode démo sans token réel.
const DEMO_EXISTING_PATHS: Record<string, string[]> = {
  'toi/mon-app-ios': ['README.md', 'src/App.tsx'],
  'toi/site-portfolio': ['README.md', 'index.html'],
  'toi/jeu-prototype': ['README.md'],
}

const START_STEPS: UploadStep[] = [
  { id: 'files', label: 'Envoi des fichiers (démo)', status: 'pending' },
  { id: 'tree', label: "Construction de l'arborescence", status: 'pending' },
  { id: 'commit', label: 'Création du commit', status: 'pending' },
  { id: 'ref', label: 'Mise à jour de la branche', status: 'pending' },
]

export class DemoClient implements GitProvider {
  private done = new Set<string>()
  private failedOnce = new Set<string>()

  async validateToken(): Promise<{ login: string }> {
    await wait(400)
    return { login: 'demo-user' }
  }

  async listRepos(): Promise<RepoRef[]> {
    await wait(500)
    return DEMO_REPOS
  }

  async listBranches(repo: RepoRef): Promise<string[]> {
    await wait(350)
    return DEMO_BRANCHES[repo.fullName] ?? [repo.defaultBranch]
  }

  async listExistingPaths(repo: RepoRef, branch: BranchRef): Promise<Set<string>> {
    await wait(300)
    if (branch.isNew) return new Set()
    return new Set(DEMO_EXISTING_PATHS[repo.fullName] ?? [])
  }

  async createPullRequest(repo: RepoRef, branch: BranchRef, title: string): Promise<PullRequestResult> {
    await wait(400)
    return { url: `https://github.com/${repo.fullName}/pull/42`, number: 42 }
  }

  async commit(plan: CommitPlan, callbacks: CommitCallbacks, onlyItemIds?: string[]): Promise<SendResult> {
    const steps = START_STEPS.map((s) => ({ ...s }))
    const emitSteps = () => callbacks.onSteps(steps.map((s) => ({ ...s })))

    const eligible = plan.files.filter((f) => !f.excluded)
    const idsToAttempt = new Set(onlyItemIds ?? eligible.map((f) => f.id))

    const items: UploadItem[] = eligible.map((f) => ({
      id: f.id,
      path: f.renamedPath ?? joinTargetPath(plan.targetPath, f.relativePath),
      size: f.size,
      status: this.done.has(f.id) ? 'done' : idsToAttempt.has(f.id) ? 'pending' : 'error',
    }))
    const emitItems = () => callbacks.onItems(items.map((i) => ({ ...i })))

    emitSteps()
    emitItems()
    steps[0].status = 'uploading'
    emitSteps()

    let index = 0
    for (const docked of eligible) {
      index += 1
      if (!idsToAttempt.has(docked.id) || this.done.has(docked.id)) continue
      const item = items.find((i) => i.id === docked.id)!
      item.status = 'uploading'
      item.bytesSent = 0
      emitItems()

      // Simule une progression à l'octet en quelques paliers, comme le ferait un vrai upload
      // XMLHttpRequest — utile pour tester l'affichage sans dépendre d'un vrai gros fichier.
      const totalWait = 280 + Math.random() * 260
      const ticks = 4
      for (let t = 1; t <= ticks; t += 1) {
        await wait(totalWait / ticks)
        item.bytesSent = Math.round((docked.size * t) / ticks)
        emitItems()
      }

      // Simule un échec la première fois sur ~1 fichier sur 6, pour pouvoir tester "Réessayer".
      const shouldFailOnce = index % 6 === 0 && !this.failedOnce.has(docked.id)
      if (shouldFailOnce) {
        this.failedOnce.add(docked.id)
        item.status = 'error'
        item.error = 'Erreur réseau simulée (démo)'
      } else {
        this.done.add(docked.id)
        item.status = 'done'
      }
      emitItems()
    }

    const anyFailed = items.some((i) => i.status === 'error')
    if (anyFailed) {
      steps[0].status = 'error'
      emitSteps()
      throw new GitDockError('INCOMPLETE')
    }
    steps[0].status = 'done'
    emitSteps()

    for (const step of [steps[1], steps[2], steps[3]]) {
      step.status = 'uploading'
      emitSteps()
      await wait(400)
      step.status = 'done'
      emitSteps()
    }

    const fakeSha = Math.random().toString(16).slice(2, 9) + Math.random().toString(16).slice(2, 9)
    return {
      commitSha: fakeSha,
      commitUrl: `https://github.com/${plan.repo.fullName}/commit/${fakeSha}`,
      filesSent: items.length,
      filesFailed: 0,
    }
  }
}
