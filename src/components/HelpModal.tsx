interface Props {
  open: boolean
  onClose: () => void
}

const sections = [
  {
    title: 'Connexion GitHub',
    content:
      'Utilisez un token GitHub disposant des droits nécessaires pour lire les dépôts et envoyer du contenu. Le token est conservé localement sur cet appareil et n’est pas transmis à un service tiers.',
  },
  {
    title: 'Mode Démo',
    content:
      'Le mode Démo permet de parcourir le flux complet sans envoyer de fichier sur GitHub. Les dépôts, branches et commits affichés sont simulés.',
  },
  {
    title: 'Dépôt et branche',
    content:
      'Ajoutez vos fichiers, choisissez un dépôt accessible, puis sélectionnez une branche existante ou saisissez le nom d’une nouvelle branche. Le chemin cible permet de placer les fichiers dans un dossier du dépôt.',
  },
  {
    title: 'Gestion des conflits',
    content:
      'Lorsqu’un fichier existe déjà, choisissez Renommer pour conserver les deux versions, Remplacer pour mettre à jour le fichier distant, ou Ignorer pour ne pas envoyer ce fichier.',
  },
  {
    title: 'Pull Request',
    content:
      'Après un envoi vers une nouvelle branche, Treeporter propose de créer une Pull Request. Vous pouvez ensuite l’ouvrir sur GitHub pour la relire et la fusionner.',
  },
]

const faq = [
  {
    question: 'Mes fichiers sont-ils envoyés pendant la sélection ?',
    answer:
      'Non. L’envoi ne commence qu’après la vérification des conflits et votre confirmation depuis l’aperçu.',
  },
  {
    question: 'Puis-je utiliser Treeporter sur iPhone ?',
    answer:
      'Oui. Ouvrez Treeporter dans Safari, puis utilisez Partager → Sur l’écran d’accueil pour l’installer comme application.',
  },
  {
    question: 'Que faire si un dépôt vide est détecté ?',
    answer:
      'Initialisez le dépôt sur GitHub avec un premier commit, par exemple un README, puis rechargez la liste des dépôts dans Treeporter.',
  },
]

export function HelpModal({ open, onClose }: Props) {
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
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="credits-modal-header">
          <div>
            <div
              className="section-label"
              style={{ margin: 0 }}
            >
              Guide
            </div>

            <h2 id="help-title">Aide Treeporter</h2>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Fermer l’aide"
          >
            Fermer
          </button>
        </div>

        <div className="help-content">
          {sections.map((section) => (
            <section
              key={section.title}
              className="help-section"
            >
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </section>
          ))}

          <section className="help-section">
            <h3>FAQ</h3>

            <div className="help-faq">
              {faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}