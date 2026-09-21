<img width="192" height="192" alt="icon-192" src="https://github.com/user-attachments/assets/ea745944-d66c-4704-87ea-ded9fbe4d2a0" />
# Treeporter — zone de transfert depuis n'importe quel appareil → GitHub (V2.0.0)

PWA mobile-first : ajoute des fichiers/dossiers depuis l'app **Fichiers** de l'iPhone (arborescence conservée)
et envoie-les vers un dépôt GitHub en **un seul commit atomique**, via la Git Data API.

⭐ Si Treeporter vous est utile, pensez à laisser une étoile sur GitHub.

ou, cliquez sur ce lien : https://qrco.de/bh0fIP et laisse des étoiles et un commentaire !

Screenshots :

<img width="585" height="1266" alt="IMG_3879" src="https://github.com/user-attachments/assets/fde8f83a-d3c4-4bb9-a26d-9d18b60b08cd" />

<img width="585" height="1266" alt="IMG_3880" src="https://github.com/user-attachments/assets/f7aa294a-5ecc-48e6-be96-6a587f7fbba7" />

<img width="941" height="907" alt="Capture d&#39;écran 2026-09-21 183838" src="https://github.com/user-attachments/assets/2e4ccc8e-f45c-4b15-b254-b64dfe3fe643" />

(après la connexion)

<img width="932" height="892" alt="Capture d&#39;écran 2026-09-21 184159" src="https://github.com/user-attachments/assets/025b6d5c-8986-422d-b47c-c84dc77c19b1" />

(après l'ajout de fichiers)

## 1. Installer et lancer en local

Prérequis : Node.js 18+ et npm (sur ton Mac/PC).

```bash
cd treeporter
npm install
npm run dev
```

Le terminal affiche deux adresses :
- `Local: http://localhost:5173` → à ouvrir sur l'ordinateur pour un premier aperçu rapide.
- `Network: http://192.168.x.x:5173` → à ouvrir **dans Safari sur ton iPhone**, à condition que l'iPhone et
  l'ordinateur soient sur le **même réseau Wi-Fi**.

⚠️ Sur cette adresse réseau locale (http, pas https), tu peux tester toute l'interface et le **mode démo**
normalement, mais le service worker (cache hors-ligne) ne s'enregistrera pas — c'est une restriction des
navigateurs, pas un bug. Pour une vraie installation PWA complète, passe à l'étape 2.

## 2. Déployer pour une vraie installation PWA (HTTPS)

Le service worker et l'ajout à l'écran d'accueil dans de bonnes conditions demandent du HTTPS. Le plus simple,
gratuit, sans configuration serveur :

```bash
npm run build
```

Cela génère un dossier `dist/`. Dépose-le sur l'un de ces hébergeurs statiques gratuits :
- **Cloudflare Pages** ou **Netlify** : glisser-déposer le dossier `dist` sur leur interface web (aucune ligne de
  commande nécessaire).
- **Vercel** ou **GitHub Pages** : fonctionnent aussi très bien si tu les utilises déjà.

Tu obtiens une URL `https://....` — c'est celle-là que tu utiliseras au quotidien sur ton iPhone.

## 3. Installer sur l'écran d'accueil de l'iPhone

1. Ouvre l'URL (locale ou déployée) dans **Safari**.
2. Bouton **Partager** (carré avec flèche vers le haut).
3. **Sur l'écran d'accueil** → Ajouter.

L'icône Treeporter apparaît alors comme une app, en plein écran, sans barre d'adresse.

## 4. Tester sans compte GitHub (mode démo)

Sur l'écran de connexion, appuie sur **« Essayer sans compte GitHub (démo locale) »**. Tu peux alors tester tout
le parcours : ajout de fichiers/dossiers, choix d'un dépôt et d'une branche fictifs, aperçu, envoi avec
progression. La démo simule volontairement l'échec d'environ 1 fichier sur 6 la première fois, pour que tu
puisses aussi tester le bouton **« Réessayer »**. Rien n'est envoyé sur internet en mode démo.

## 5. Connexion GitHub réelle

**Utilise un token classique ("Personal access token (classic)") pour l'instant** — les tokens *fine-grained*
renvoient actuellement une erreur 401 dans certains cas non encore diagnostiqués (voir la note en bas de
section). Le fonctionnement avec un token classique, lui, est stable et vérifié.

1. Sur github.com → **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Génère un token avec le scope **`repo`** (accès complet aux dépôts privés/publics que tu utilises).
3. Colle ce token dans Treeporter à l'écran de connexion. Il reste stocké uniquement sur ton iPhone (dans le
   stockage local du navigateur) — il n'est jamais envoyé ailleurs qu'à `api.github.com`, jamais dans une URL,
   jamais dans un log, jamais commité dans le dépôt.

> **Note — tokens fine-grained (401 connu) :** diagnostic établi en V1.2 — l'endpoint `/user` que Treeporter
> utilise pour valider un token fonctionne avec les tokens fine-grained et ne nécessite aucune permission
> particulière (vérifié dans la documentation GitHub à jour). Ce n'est donc pas un problème de compatibilité
> d'endpoint côté Treeporter. Les causes les plus probables : le token a expiré (obligatoire pour un fine-grained,
> 1 an maximum, contrairement à un classique qui peut être permanent), ou il a été copié incomplet (un token
> fine-grained fait ~93+ caractères contre ~40 pour un classique, plus difficile à sélectionner en entier au
> clavier iPhone). Non corrigé côté code pour ne pas risquer de casser le fonctionnement actuel avec les tokens
> classiques — Treeporter affiche maintenant un message d'erreur spécifique à ce cas plutôt qu'un message générique.

## Nouveautés V2.0.0

- **Support des archives .zip** : troisième option dans "+ Ajouter", extrait l'arborescence
  complète d'une archive (via `fflate`, 8 Ko).
- **Création de Pull Request** en un clic sur l'écran de résultat, quand l'envoi a créé une
  nouvelle branche.
- **Historique des 10 derniers envois**, affiché sur l'écran de résultat.
- **Progression à l'octet près** pour les fichiers volumineux pendant l'envoi.
- **Mise à jour de l'app jamais appliquée pendant un envoi en cours** — différée jusqu'à la fin
  du transfert.
- **Refactor interne** : `App.tsx` réduit de 436 à ~230 lignes, logique extraite en 5 hooks
  dédiés (`useAuth`, `useDock`, `useDestination`, `useConflicts`, `useTransfer`,
  `usePwaUpdate`).
- **Tests automatisés** (`npm run test`) sur la logique de gestion de fichiers et de détection
  de token — filet de sécurité pour les évolutions futures.

## Nouveautés V1.2

- **Persistance du token plus fiable** : ajout d'un secours `localStorage` en plus d'IndexedDB (bugs connus
  d'IndexedDB dans les PWA installées sur iOS) + nouvelle tentative automatique si la première ouverture échoue.
- **Type de token affiché** (badge « Classic »/« Fine-grained ») une fois connecté.
- **Vérification des droits d'écriture** sur le dépôt sélectionné avant même de choisir la branche (basée sur les
  permissions renvoyées par GitHub), pour éviter de découvrir un token en lecture seule après coup.
- **Diagnostic du problème 401 des tokens fine-grained** : non corrigé (voir note ci-dessous), mais message
  d'erreur spécifique et actionnable désormais affiché.

## Nouveautés V1.1

- **Détection de conflits** : avant l'envoi, Treeporter vérifie si des fichiers existent déjà au même chemin dans
  le dépôt/branche cible, et propose de les **remplacer**, **ignorer**, ou **renommer automatiquement**
  (fichier ↔ fichier ou en un clic pour tous).
- Noms de fichiers accentués (é, à, ç…) normalisés pour correspondre exactement à ce qui est envoyé sur GitHub.
- Messages d'erreur plus clairs (réseau coupé, permissions insuffisantes, dépôt/branche introuvable).
- Confirmation demandée avant de vider la liste de fichiers ou de se déconnecter.
- Repérage des fichiers volumineux (> 20 Mo) directement dans l'aperçu avant envoi.

## Déploiement sur GitHub Pages (pour tester depuis l'iPhone)

Le projet est préconfiguré pour GitHub Pages via GitHub Actions : un simple `git push` build et publie
automatiquement le site.

### Étape 1 — Pousser le code sur GitHub (nécessite un ordinateur, une seule fois)

```bash
cd treeporter
git init
git add .
git commit -m "Treeporter V2.0.0"
git branch -M main
git remote add origin https://github.com/<ton-compte>/<nom-du-repo>.git
git push -u origin main
```

### Étape 2 — Faire correspondre le `base` Vite au nom exact du dépôt

Dans `vite.config.ts`, la constante `base` doit être `'/<nom-du-repo>/'` (respecte la casse). Si ton dépôt
s'appelle par exemple `treeporter`, laisse `base = '/Treeporter-main/'`. Si tu le nommes autrement, modifie cette seule
ligne avant de pousser (ou pousse une petite mise à jour ensuite).

### Étape 3 — Activer GitHub Pages

Sur GitHub : **Settings → Pages → Build and deployment → Source : "GitHub Actions"**. Rien d'autre à configurer,
le workflow `.github/workflows/deploy.yml` s'occupe du build et de la publication à chaque push sur `main`.
Le premier déploiement prend 1 à 2 minutes (onglet **Actions** du repo pour suivre la progression).

### Étape 4 — Récupérer l'URL et l'ouvrir sur l'iPhone

L'adresse sera :

```
https://<ton-compte>.github.io/<nom-du-repo>/
```

Ouvre-la dans **Safari sur l'iPhone**, puis **Partager → Sur l'écran d'accueil** pour l'installer comme PWA —
cette fois en HTTPS complet, donc avec le service worker actif (contrairement au test en réseau local).

Suivez Wiyotl sur Instagram, DEV Community et Github.

Wiyotl est une marque deposée ; interdiction de réutiliser sans l'accord du créateur.
