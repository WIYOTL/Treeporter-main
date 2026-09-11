interface Props {
  onCredits: () => void
}

export function AppFooter({ onCredits }: Props) {
  return (
    <footer className="app-footer">
      <div className="app-footer-meta">
        <span>Treeporter v2.0.0</span>
        <span>Développé par Wiyotl</span>
        <span>© 2026 Wiyotl. Tous droits réservés.</span>
      </div>
      <nav className="app-footer-links" aria-label="Pied de page">
        <button className="app-footer-link" onClick={onCredits}>Crédits</button>
        <a className="app-footer-link" href="https://github.com/WIYOTL/Treeporter" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="app-footer-link" href="https://github.com/WIYOTL/Treeporter#readme" target="_blank" rel="noreferrer">
          Aide
        </a>
      </nav>
    </footer>
  )
}