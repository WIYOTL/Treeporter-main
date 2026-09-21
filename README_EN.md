<img width="192" height="192" alt="icon-192" src="https://github.com/user-attachments/assets/ea745944-d66c-4704-87ea-ded9fbe4d2a0" />
# Treeporter — transfer zone from any device → GitHub (V2.0.0)

Mobile-first PWA: add files/folders from the iPhone's **Files** app (preserving the directory structure)
and push them to a GitHub repository in **a single atomic commit** via the Git Data API.

github
file-transfer
file-upload
developer-tools
productivity
opensource
cross-platform

⭐ If you find Treeporter useful, please consider starring it on GitHub.

or click on this link : https://qrco.de/bh0fIP and leave a rating and a comment!

Screenshots :

<img width="585" height="1266" alt="IMG_3879" src="https://github.com/user-attachments/assets/fde8f83a-d3c4-4bb9-a26d-9d18b60b08cd" />

<img width="585" height="1266" alt="IMG_3880" src="https://github.com/user-attachments/assets/f7aa294a-5ecc-48e6-be96-6a587f7fbba7" />

<img width="941" height="907" alt="Capture d&#39;écran 2026-09-21 183838" src="https://github.com/user-attachments/assets/2e4ccc8e-f45c-4b15-b254-b64dfe3fe643" />

(after logging in)

<img width="932" height="892" alt="Capture d&#39;écran 2026-09-21 184159" src="https://github.com/user-attachments/assets/025b6d5c-8986-422d-b47c-c84dc77c19b1" />

(after adding files. In this example, we used a `files/` folder containing an `index.html` file.
You can also upload a .ZIP archive, a single file, or an entire folder (the project directory structure is preserved!!))

<img width="915" height="927" alt="Capture d&#39;écran 2026-09-21 184731" src="https://github.com/user-attachments/assets/35109af9-f629-4793-9e49-6a4abbd84bb3" />

(choose the GitHub repository: you must select the repository where you will upload and save your file or entire folder)

<img width="951" height="607" alt="Capture d&#39;écran 2026-09-21 185207" src="https://github.com/user-attachments/assets/896fe340-7e2f-436c-aa2b-a67cff31e06e" />

(Check your decision: review what you really want to send one last time; otherwise, click the "Back" button and make any desired changes.)

<img width="952" height="887" alt="Capture d&#39;écran 2026-09-21 185552" src="https://github.com/user-attachments/assets/a3915ab9-2e44-487e-9f75-0332dae51ff9" />

(Pushing to GitHub: make sure your Personal Access Token has "Read and Write" permissions for "Contents." Otherwise, you will encounter an error and the push will fail.
If the push is successful, check the repository you selected earlier, and you will have a quick backup of your entire project!!)

## 1. Install and launch locally

Prerequisites: Node.js 18+ and npm (on your Mac/PC).

```bash
cd treeporter
npm install
npm run dev
```

The terminal displays two addresses:
- `Local: http://localhost:5173` → to be opened on the computer for a quick initial overview.
- `Network: http://192.168.x.x:5173` → to be opened **in Safari on your iPhone**, provided that the iPhone and
  the computer are on the **same Wi-Fi network**.

⚠️ At this local network address (http, not https), you can test the entire interface and **demo mode**
as usual, but the service worker (offline cache) will not register—this is a browser
restriction, not a bug. For a full PWA installation, proceed to step 2.

## 2. Deploy for a true PWA installation (HTTPS)

Service workers and "Add to Home Screen" functionality require HTTPS to work properly. The simplest,
free option that requires no server configuration is:

```bash
npm run build
```

This generates a `dist/` folder. Upload it to one of these free static hosting services:
- **Cloudflare Pages** or **Netlify**: drag and drop the `dist` folder onto their web interface (no command line
  required).
- **Vercel** or **GitHub Pages**: these also work very well if you already use them.
  
You get a `https://....` URL—that’s the one you’ll use on your iPhone on a daily basis.

## 3. Install on the iPhone Home Screen

1. Open the URL (local or deployed) in **Safari**.
2. **Share** button (square with an upward-pointing arrow).
3. **Add to Home Screen** → Add.

The Treeporter icon then appears as an app, in full screen, without an address bar.

## 4. Test without a GitHub account (demo mode)

On the login screen, tap **"Try without a GitHub account (local demo)"**. 
You can then test the entire workflow: adding files/folders, selecting a dummy repository and branch, previewing, 
and uploading with a progress indicator. 
The demo intentionally simulates a failure for about 1 in 6 files on the first attempt so that you can also test the **"Retry"** button. 
Nothing is sent over the internet in demo mode.

## 5. Real GitHub connection

**Use a classic token ("Personal access token (classic)") for now** — *fine-grained* tokens
currently return a 401 error in certain undiagnosed cases (see the note at the bottom of the
section). Using a classic token, however, is stable and verified.

1. On github.com → **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Generate a token with the **`repo`** scope (full access to the private/public repositories you use).
3. Paste this token into Treeporter on the login screen. It is stored only on your iPhone (in the
   browser's local storage)—it is never sent anywhere other than `api.github.com`, never in a URL,
   never in a log, and never committed to the repository.

> **Note — fine-grained tokens (401 error):** diagnosis established in V1.2 — the `/user` endpoint that Treeporter
> uses to validate a token works with fine-grained tokens and requires no specific
> permissions (verified against current GitHub documentation). Therefore, this is not an endpoint
> compatibility issue on the Treeporter side. The most likely causes are: the token has expired (mandatory for fine-grained tokens,
> 1-year maximum, unlike standard tokens which can be permanent), or it was copied incompletely (a fine-grained
> token is ~93+ characters long compared to ~40 for a standard one, making it harder to select the whole thing
> using an iPhone keyboard). No code-level fix was implemented to avoid risking breakage of current functionality
> with standard tokens; instead, Treeporter now displays a specific error message for this scenario rather than a generic one.

## What's New in V2.0.0

- **.zip archive support**: third option under "+ Add"; extracts the archive's
  full directory structure (via `fflate`, 8 KB).
- **One-click Pull Request creation** on the results screen when the upload
  creates a new branch.
- **History of the last 10 uploads**, displayed on the results screen.
- **Byte-level progress tracking** for large files during upload.
- **App updates never applied during an active upload**—deferred until
  the transfer completes.
- **Internal refactoring**: `App.tsx` reduced from 436 to ~230 lines; logic
  extracted into 5 dedicated hooks (`useAuth`, `useDock`, `useDestination`,
  `useConflicts`, `useTransfer`, `usePwaUpdate`).
- **Automated tests** (`npm run test`) for file handling and token detection
  logic—providing a safety net for future changes.

## What's New in V1.2.1

- **More reliable token persistence**: added `localStorage` fallback alongside IndexedDB (due to known IndexedDB bugs in PWAs installed on iOS) + automatic retry if the initial opening fails.
- **Token type displayed** ("Classic"/"Fine-grained" badge) after logging in.
- **Write access check** for the selected repository performed before branch selection (based on permissions returned by GitHub), to avoid discovering a read-only token only after the fact.
- **Diagnosis of the 401 error with fine-grained tokens**: not fixed (see note below), but a specific, actionable error message is now displayed.

## What's New in V1.2

- **Conflict detection**: before uploading, Treeporter checks if files already exist at the same path in the target repository/branch and offers options to **replace**, **skip**, or **automatically rename** them (individual file handling or a one-click option for all).
- Filenames with accents (é, à, ç, etc.) normalized to match exactly what is sent to GitHub.
- Clearer error messages (network disconnection, insufficient permissions, repository/branch not found).
- Confirmation required before clearing the file list or logging out.
- Identification of large files (> 20 MB) directly in the pre-upload preview.

## What's New in V1.1

- Bugs fixes and corrections of the V1.0.0.

## What's New in V1.0.0

- First launch of Treeporter.
- First version of the PWA.
- First real actions.
- Only support of natives files and small folders.

## Deployment to GitHub Pages (for testing from an iPhone)

The project is preconfigured for GitHub Pages via GitHub Actions: a simple `git push` automatically builds and publishes the site.

### Step 1 — Push the code to GitHub (requires a computer, one-time only)

```bash
cd treeporter
git init
git add .
git commit -m "Treeporter V2.0.0"
git branch -M main
git remote add origin https://github.com/<your-account>/<repo-name>.git
git push -u origin main
```

### Step 2 — Match the Vite `base` to the exact repository name

In `vite.config.ts`, the `base` constant must be `'/<repo-name>/'` (case-sensitive). For example, if your repository
is named `treeporter`, set `base = '/Treeporter-main/'`. If you name it differently, modify just this
line before pushing (or push a small update afterwards).

### Step 3 — Enable GitHub Pages

On GitHub: **Settings → Pages → Build and deployment → Source: "GitHub Actions"**. There is nothing else to configure;
the `.github/workflows/deploy.yml` workflow handles the build and deployment on every push to `main`.
The initial deployment takes 1–2 minutes (check the repo's **Actions** tab to track progress).

### Step 4 — Get the URL and open it on the iPhone

The address will be:
```
https://<your-account>.github.io/<repo-name>/
```

Open it in **Safari on the iPhone**, then select **Share → Add to Home Screen** to install it as a PWA —
this time over full HTTPS, so the service worker is active (unlike the local network test).

Follow Wiyotl on Instagram (https://www.instagram.com/wiyotl/), DEV Community (https://dev.to/wiyotl), and GitHub.

Wiyotl is a registered trademark; reuse without the creator's permission is prohibited.
