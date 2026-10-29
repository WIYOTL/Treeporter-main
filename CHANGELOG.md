# Changelog

Ce fichier retrace l'évolution de Treeporter, de sa première version (V1) à la version actuelle (V2.1.0).

Les versions sont présentées dans l'ordre chronologique inverse (la plus récente en premier).

Les informations proviennent des fichiers README.md (français) et README_EN.md (anglais) à la racine du projet. Aucun historique git (tags, commits) n'est disponible localement pour confirmer indépendamment ces notes de version.

---

## V2.1.0

_Note : la publication officielle de V2.1.0 n'est pas confirmée par un tag ou une release GitHub ; cette section reprend les changements documentés dans les README._

### Ajout
- Internationalisation complète : interface disponible en français et en anglais, avec un sélecteur de langue FR/EN.
- Authentification GitHub : prise en charge des Personal Access Tokens classic et fine-grained, avec détection automatique du type de token et affichage d'un badge correspondant.
- Diagnostics plus précis pour les erreurs GitHub HTTP 401, 403, 404 et 429, avec indications sur les permissions requises et les éventuelles approbations d'organisation.
- Protection des jetons : les PAT ne sont jamais exposés dans les messages d'erreur, les journaux ou l'interface (redaction automatique).
- Pagination complète des branches : récupération de toutes les pages de branches, pas seulement les 100 premières.
- Messages dédiés pour les erreurs HTTP 409, 422 et 5xx : messages explicites avec actions adaptées, sans affirmer de modification de dépôt non démontrée.
- Messages d'erreur de transfert et de vérification des conflits améliorés : messages plus clairs avec indication des actions concrètes ; aucune résolution automatique n'est promise.

### Problème connu
- Un transfert ZIP avec un PAT Fine-grained peut rencontrer l'erreur GitHub « Resource not accessible by personal access token ». La cause n'est pas identifiée et le problème n'est pas confirmé comme résolu. Tous les Fine-grained PAT ne sont pas nécessairement concernés. Utiliser un PAT Classic ou un PAT Fine-grained avec la permission `Contents: Read and Write` permet de contourner ce problème.

---

## V2.0.0

### Added
- Support des archives .zip : troisième option dans « + Ajouter », extrait l'arborescence complète d'une archive (via `fflate`, 8 Ko).
- Création de Pull Request en un clic sur l'écran de résultat, quand l'envoi a créé une nouvelle branche.
- Historique des 10 derniers envois, affiché sur l'écran de résultat.
- Progression à l'octet près pour les fichiers volumineux pendant l'envoi.
- Tests automatisés (`npm run test`) sur la logique de gestion de fichiers et de détection de token.

### Changed
- Mise à jour de l'app jamais appliquée pendant un envoi en cours — différée jusqu'à la fin du transfert.
- Refactor interne : `App.tsx` réduit de 436 à ~230 lignes ; logique extraite en 5 hooks dédiés (`useAuth`, `useDock`, `useDestination`, `useConflicts`, `useTransfer`, `usePwaUpdate`).

---

## V1.2.1

*Documenté uniquement dans README_EN.md (anglais). Aucune section correspondante n'est présente dans README.md (français) : une section V1.2.1 y avait été ajoutée mais contenait un doublon exact de V1.2 et a été retirée._

### Added
- Persistance du token plus fiable : ajout d'un secours `localStorage` en plus d'IndexedDB (bugs connus d'IndexedDB dans les PWA installées sur iOS) + nouvelle tentative automatique si la première ouverture échoue.
- Type de token affiché (badge « Classic » / « Fine-grained ») une fois connecté.

### Changed
- Vérification des droits d'écriture sur le dépôt sélectionné avant même de choisir la branche (basée sur les permissions renvoyées par GitHub).
- Diagnostic des erreurs de tokens fine-grained : message d'erreur spécifique et actionable pour le scénario 401 (diagnostic établi, pas de correction du code sous-jacent).

---

## V1.2

*L'attribution des fonctionnalités à cette version diffère entre les deux langues, et l'historique exact ne peut pas être déterminé faute d'historique git :_

- **Dans README.md (français)** : V1.2 documente la persistance du token (`localStorage` + IndexedDB), le badge de type de token, la vérification des droits d'écriture et le diagnostic 401 pour les tokens fine-grained.
- **Dans README_EN.md (anglais)** : V1.2 documente la détection de conflits, la normalisation des noms de fichiers accentués, les messages d'erreur plus clairs, la confirmation avant suppression/déconnexion, et le repérage des fichiers volumineux.

Cette incohérence entre les deux READMEs est signalée telle quelle ; aucune des deux versions n'est privilégiée.

### Added (selon README_EN.md)
- Détection de conflits : avant l'envoi, Treeporter vérifie si des fichiers existent déjà au même chemin dans le dépôt/branche cible, et propose de les remplacer, ignorer ou renommer.
- Noms de fichiers accentués (é, à, ç…) normalisés pour correspondre exactement à ce qui est envoyé sur GitHub.

### Changed (selon README_EN.md)
- Messages d'erreur plus clairs (réseau coupé, permissions insuffisantes, dépôt/branche introuvable).
- Confirmation demandée avant de vider la liste de fichiers ou de se déconnecter.
- Repérage des fichiers volumineux (> 20 Mo) directement dans l'aperçu avant envoi.

### Added / Changed (selon README.md)
- Persistance du token plus fiable : ajout d'un secours `localStorage` en plus d'IndexedDB + nouvelle tentative automatique si la première ouverture échoue.
- Type de token affiché (badge « Classic » / « Fine-grained ») une fois connecté.
- Vérification des droits d'écriture sur le dépôt sélectionné avant même de choisir la branche.
- Diagnostic des erreurs de tokens fine-grained : messages tenant compte de l'opération et des permissions.

---

## V1.1

*L'attribution des fonctionnalités à cette version diffère entre les deux langues, et l'historique exact ne peut pas être déterminé faute d'historique git :_

- **Dans README.md (français)** : V1.1 documente la détection de conflits, la normalisation des noms de fichiers accentués, les messages d'erreur plus clairs, la confirmation avant suppression/déconnexion, et le repérage des fichiers volumineux.
- **Dans README_EN.md (anglais)** : V1.1 documente uniquement des corrections de bugs de la V1.0.0.

Cette incohérence entre les deux READMEs est signalée telle quelle ; aucune des deux versions n'est privilégiée.

### Added (selon README.md)
- Détection de conflits : avant l'envoi, Treeporter vérifie si des fichiers existent déjà au même chemin dans le dépôt/branche cible, et propose de les remplacer, ignorer ou renommer.
- Noms de fichiers accentués (é, à, ç…) normalisés pour correspondre exactement à ce qui est envoyé sur GitHub.

### Changed (selon README.md)
- Messages d'erreur plus clairs (réseau coupé, permissions insuffisantes, dépôt/branche introuvable).
- Confirmation demandée avant de vider la liste de fichiers ou de se déconnecter.
- Repérage des fichiers volumineux (> 20 Mo) directement dans l'aperçu avant envoi.

### Fixed (selon README_EN.md)
- Corrections de bugs de la V1.0.0.

---

## V1.0.0

Documenté dans README.md (français) et README_EN.md (anglais).

### Added
- Premier lancement de Treeporter.
- Première version de la PWA.
- Premières actions réelles.
- Support limité aux fichiers natifs et petits dossiers.

---

## Versions non documentées

Les versions potentielles entre V1.0.0 et V2.0.0 (par exemple V1.3, V1.4, V1.5, V1.6, V1.7, V1.8, V1.9) ne sont mentionnées dans aucune source disponible. Leur existence n'est ni confirmée ni infirmée.

## Sources utilisées

- `README.md` (français) : sections « Nouveautés V2.1.0 », « Nouveautés V2.0.0 », « Nouveautés V1.2.1 », « Nouveautés V1.2 », « Nouveautés V1.1 », « Nouveautés V1.0.0 ».
- `README_EN.md` (anglais) : sections « What's New in V2.1.0 », « What's New in V2.0.0 », « What's New in V1.2.1 », « What's New in V1.2 », « What's New in V1.1 », « What's New in V1.0.0 ».
- `package.json` : numéro de version actuel (2.1.0).
- Code source (`src/services/github.ts`, `src/services/tokenType.ts`, `src/i18n/messages/fr.ts`, `src/i18n/messages/en.ts`, `src/components/LanguageSwitcher.tsx`) : confirmation de l'implémentation des fonctionnalités documentées pour V2.1.0.

## Limitations

- Aucun historique git (tags, commits) n'est disponible localement pour le dossier de travail courant ; les dates de publication ne sont donc pas indiquées.
- Les incohérences entre README.md et README_EN.md (attribution des fonctionnalités aux versions V1.1, V1.2 et V1.2.1 ; absence de V1.2.1 dans la version française) sont signalées telles quelles.
- Aucune fonctionnalité, date ou numéro de version n'a été inventé.
