<img width="192" height="192" alt="Treeporter logo" src="https://github.com/user-attachments/assets/ea745944-d66c-4704-87ea-ded9fbe4d2a0" />

# Treeporter — Simple. Fast. Treeporter.

**Upload your files to GitHub without complex Git commands or a terminal.**

Treeporter is an open-source web app that simplifies
the process of uploading files, entire folders, and ZIP archives to
a GitHub repository, thanks to a simple and accessible interface.

- 📁 Upload individual files or entire folders.
- 🗜️ Import ZIP archives.
- 🌳 Preserve your file directory structure.
- 📱 Use Treeporter on any compatible device.
- ⚡ Streamline your GitHub workflow without using the terminal.

### 🚀 Try Treeporter

**[Open the demo](https://wiyotl.github.io/Treeporter-main/)**

Want to upload your own files?
Connect your GitHub account to perform real uploads.

Treeporter is open source and available for free.

**Simple. Fast. Treeporter.**

---------------------- ------------------------------------------------------------------------------

## 🛠️ Need help with GitHub?

Are you experiencing a specific issue when transferring files to GitHub?

I offer a **GitHub diagnostic for €20**, including targeted tests and a PDF report presenting the results and recommendations.

- 💶 **Price: €20**
- 🔎 Up to three targeted tests, when technically feasible.
- 📄 A PDF report with results, limitations, and recommendations.
- ⏱️ Estimated turnaround time: 72 hours after confirmation of the scope and receipt of the necessary information.

**[View service details](#-github-transfer-diagnostic--20)**

*For more information about this service, see the detailed description at the bottom of this page.*

*Problem resolution is not guaranteed. Payment terms and availability are confirmed in writing before the service begins.*

---------- ------------------------------------------------------------------------------------------

## 📥 Downloads

- 🌐 [Web Version](https://wiyotl.github.io/Treeporter-main/)
- 🍎 [macOS Preview](https://github.com/Wiyotl/Treeporter-main/releases)
- 💻 [Source Code](https://github.com/Wiyotl/Treeporter-main)

-----------------------------------------------------------------------------------------------------

## 💬 Give Feedback on Treeporter

Your feedback helps me identify priorities for improving Treeporter.

- 📝 **Share your experience:** [Fill out the feedback form](https://chatform.in/f/treeporter-user-feedback-0cef1b).
- 💡 **Suggest an idea:** [Join the GitHub discussions](https://github.com/Wiyotl/Treeporter-main/discussions/4).
- 🐛 **Report a technical issue:** [Open a GitHub issue](https://github.com/Wiyotl/Treeporter-main/issues).
- 💬 **Join the Wiyotl community on Reddit:** [r/wiyotltools_dev](https://www.reddit.com/r/wiyotltools_dev/) to discuss Treeporter and other Wiyotl projects.

⭐ If you find Treeporter useful, you can also [star the GitHub repository](https://github.com/Wiyotl/Treeporter-main).

-------------------------------------------------------------------------- -----------------------------------

github
file-transfer
file-upload
developer-tools
productivity
opensource
cross-platform

----------------------------------------------------- --------------------------------------------------------------

## 🚀 Treeporter Pro — Under Consideration

A premium version of Treeporter is under consideration. None of these features have been announced as available at this time.

Possible features under consideration include:
- Automatic synchronization.
- Support for multiple GitHub accounts.
- Advanced project management tools.

These features are still being evaluated and may change.

**Have a suggestion?** Open a [GitHub issue](https://github.com/Wiyotl/Treeporter-main/issues) to share your ideas.

Treeporter remains open source. The features of this potential premium version have not yet been defined.

--------------------------------------------------------------------------------------- -----------------------------

## ✨ Features

- 📁 **Files and Folders** — Upload individual files or entire folders.
- 🗜️ **ZIP Archives** — Import a ZIP archive and preserve its directory structure.
- 🌳 **Preserved Structure** — Keep your project’s file organization intact.
- 🔀 **Conflict Management** — Replace, ignore, or rename files that already exist.
- 📊 **Transfer Progress** — Track the progress of your upload.
- 🔁 **Retry** — Try again with files that failed to upload.
- 🧪 **Demo mode** — Explore the interface without connecting a GitHub account.
- 📱 **Web interface** — Use Treeporter from a compatible device.

------------ ------------------------------------------------------------------------------------------------

## 📸 Discover Treeporter

Learn about the main steps using Treeporter.

<img width="585" height="1266" alt="IMG_3879" src="https://github.com/user-attachments/assets/fde8f83a-d3c4-4bb9-a26d-9d18b60b08cd" />

*Treeporter home screen.*

<img width="585" height="1266" alt="IMG_3880" src="https://github.com/user-attachments/assets/f7aa294a-5ecc-48e6-be96-6a587f7fbba7" />

*Connection interface and access to demo mode.*

<img width="941" height="907" alt="Screenshot 2026-09-21 183838" src="https://github.com/user-attachments/assets/2e4ccc8e-f45c-4b15-b254-b64dfe3fe643" />

*After logging in: access to the transfer interface.*

<img width="932" height="892" alt="Screenshot 2026-09-21 184159" src="https://github.com/user-attachments/assets/025b6d5c-8986-422d-b47c-c84dc77c19b1" />

*Adding files: Treeporter allows you to import individual files, entire folders, or ZIP archives.*

<img width="915" height="927" alt="Screenshot 2026-09-21 184731" src="https://github.com/user-attachments/assets/35109af9-f629-4793-9e49-6a4abbd84bb3" />

*Choosing the destination GitHub repository.*

<img width="951" height="607" alt="Screenshot 2026-09-21 185207" src="https://github.com/user-attachments/assets/896fe340-7e2f-436c-aa2b-a67cff31e06e" />

*Verifying the content before starting the transfer.*

<img width="952" height="887" alt="Screenshot 2026-09-21 185552" src="https://github.com/user-attachments/assets/a3915ab9-2e44-487e-9f75-0332dae51ff9" />

*Transfer result: Check the GitHub repository to confirm that the files were successfully uploaded.*

## 1. 🧑‍💻 For developers: Launch Treeporter locally

Prerequisites: Node.js 18+ and npm (on your Mac/PC).

```bash
cd treeporter
npm install
npm run dev
```

The terminal displays two addresses:

- `Local: http://localhost:5173` → Open this on your computer for a quick initial preview.

- `Network: http://192.168.x.x:5173` → to open **in Safari on your iPhone**, provided that the iPhone and

the computer are on the **same Wi-Fi network**.

⚠️ On this local network address (http, not https), you can test the entire interface and **demo mode** normally, but the service worker (offline cache) will not register — this is a browser limitation, not a bug. For a full PWA installation, proceed to step 2.

## 2. Deploy a PWA version over HTTPS

The service worker and proper integration into the home screen require HTTPS. The simplest,
free, server-free method:

```bash
npm run build
```

This creates a `dist/` folder. Upload it to one of these free static file hosting services:

- **Cloudflare Pages** or **Netlify**: drag and drop the `dist` folder onto their web interface (no command line required).

- **Vercel** or **GitHub Pages**: also work very well if you're already using them.

You'll get a URL `https://....` — this is the one you'll use daily on your iPhone.

## 3. Install on the iPhone Home Screen

1. Open the URL (local or deployed) in **Safari**.

2. **Share** button (square with an upward arrow).

3. **On Home Screen** → Add.

The Treeporter icon will then appear as a full-screen app, without an address bar.

## 4. Try Treeporter without a GitHub account

The demo mode lets you explore the interface without connecting a GitHub account.

You can test adding files and folders, choose a mock repository and branch, examine the contents, and simulate a transfer with a progress bar.

The demo intentionally simulates the failure of about one in six files on the first attempt to allow you to test the "Retry" function.

**Important:** The demo mode simulates operations. No files are sent to GitHub or transmitted over the internet.

## 5. Real GitHub connection

**Uses a classic token ("Personal access token (classic)") for now** — *fine-grained* tokens currently return a 401 error in some undiagnosed cases (see the note at the bottom of this section). The operation with a classic token is stable and verified.

1. On github.com → **Settings → Developer settings → Personal access tokens → Tokens (classic)**.

2. Generate a token with the **`repo`** scope (full access to the private/public repositories you use).

3. Paste this token into Treeporter on the login screen. It is stored in the browser and used to communicate with the GitHub API.

> 🔐 **Security:**

> - Never share your token or publish it to a GitHub repository.

> - Grant only the permissions necessary for your use.

> - If your token is exposed, revoke it immediately in your GitHub settings.

> - Log out on a shared device and avoid saving a personal token there.

> **Note — fine-grained tokens (401 known):** Diagnosis established in V1.2 — the `/user` endpoint that Treeporter
> uses to validate a token works with fine-grained tokens and requires no special permission
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

——————————————————————————————————————————

## 🛠️ GitHub Transfer Diagnostic — €20

Experiencing a specific issue when transferring files to GitHub?

I offer an independent diagnostic service using targeted tests and, where relevant, Treeporter.

**What's included:**
- Analysis of one specific file-transfer issue related to GitHub.
- Up to three targeted tests, where technically possible.
- A PDF report describing the tests performed, observed results, limitations, and recommendations.
- An indicative 72-hour delivery time after the scope is confirmed and the required information is received.

**Price: €20**

**Limitations:** no guaranteed resolution, full security audit, code changes, or unlimited support. Direct access to your repository is not required for this service. Never share passwords, access tokens, or other secrets.

Availability and payment terms will be confirmed in writing before the service begins.

This service is separate from Treeporter, which remains an open-source project.

——————————————————————————————————————————

Follow Wiyotl on Instagram (https://www.instagram.com/wiyotl/), DEV Community (https://dev.to/wiyotl), and GitHub.

Community on Reddit:
https://www.reddit.com/r/wiyotltools_dev/

----------------------------------------------

Wiyotl is a registered trademark; reuse without the creator's permission is prohibited.

