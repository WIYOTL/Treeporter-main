interface Props {
  open: boolean
  onClose: () => void
}

export function CreditsModal({ open, onClose }: Props) {
  if (!open) {
    return null
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="credits-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="credits-modal-header">
          <div>
            <div
              className="section-label"
              style={{ margin: 0 }}
            >
              À propos
            </div>

            <h2 id="credits-title">Crédits</h2>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Fermer les crédits"
          >
            Fermer
          </button>
        </div>

        <p className="credits-description">
          Treeporter est une application progressive qui facilite
          l’envoi de fichiers depuis n'importe quel appareil vers un dépôt GitHub,
          avec aperçu, gestion des conflits et création de branches.
        </p>

        <div className="credits-list">
          <p>
            <strong>Création et développement</strong>
            <span>Wiyotl</span>
          </p>

          <p>
            <strong>Marque</strong>
            <span>Wiyotl</span>
          </p>

          <p>
            <strong>Wiyotl Applications</strong>
            <span>
              React, TypeScript, Vite, VitePWA, GitHub API, JSZip
            </span>
          </p>

          <p>
            <strong>Version</strong>
            <span>2.0.0</span>
          </p>
        </div>
      </div>
    </div>
  )
}