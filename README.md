<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Vector V2

Personal OS for focus and execution — built with React 19, Firebase, and Vite.

## Run Locally

**Prerequisites:** Node.js 18+, npm

1. Install dependencies:
   ```
   npm install
   ```
2. Run the dev server (accessible on LAN at `http://<your-ip>:3000`):
   ```
   npm run dev
   ```

## Build & Deploy (Firebase Hosting)

**Prerequisites:** Firebase CLI installed (`npm install -g firebase-tools`)

### First-time Firebase setup (run once)

```bash
firebase login                # authenticate with Google
firebase projects:list        # confirm vector-app-dee90 appears
firebase use vector-app-dee90 # set as active project
```

### Deploy

```bash
npm run deploy   # builds dist/ then deploys to Firebase Hosting
```

The `firebase.json` config:
- Project: `vector-app-dee90`
- Serves from `dist/`
- Rewrites all routes to `index.html` (SPA support)
- Caches `/assets/**` for 1 year (immutable, Vite content-hashed filenames)
- Sets `no-cache` on all other files so `index.html` always revalidates
