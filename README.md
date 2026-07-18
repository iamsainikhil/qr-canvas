# QR Canvas

QR Canvas is a React + TypeScript app for generating stylish, downloadable QR codes with rich visual customization.

This repository is optimized for local development and personal/self-hosted use.

## Screenshots

### 1) App Overview

![QR Canvas builder overview](public/screenshots/qr-canvas-app-overview.png)

Full workspace view with QR type selection, live preview, and styling controls visible at once.

### 2) Control Panel Details

![QR Canvas control panel details](public/screenshots/control-panel-details.png)

Closer view of theme, pattern, color, logo, and scan label controls.

### 3) Branded Output Example

![QR Canvas branded output example](public/screenshots/branded-output-example.png)

Example final output with custom logo and scan label applied.

### 4) Dashboard and Scan Analytics

![QR Canvas dashboard](public/screenshots/dashboard.jpeg)

Personal QR library with per-code scan tracking, analytics, and management controls.

## Highlights

- Generate QR codes for:
	- URL
	- Video link
	- App link
	- Plain text
	- Wi-Fi credentials
	- Email compose links
	- SMS compose links
	- Image/PDF/MP3 file links (paste public URLs)
- Visual customization:
	- Foreground/background colors
	- Optional background gradients
	- Pattern color controls
	- Body shape styles (square, dots, rounded, classy, sharp)
	- Frame styles (square, rounded variants, pills, circle)
	- Theme presets plus custom saved themes
- Logo support:
	- Manual upload
	- Auto-favicon for URL/app/email inputs
	- Optional logo.dev integration
	- Badge sizing, padding, corner radius, and background controls
- Scan label support:
	- Custom text below QR
	- 700+ Google Fonts (loaded on demand) with family, weight, size, and transform controls
- Export and utility:
	- Adjustable output size
	- Copy QR value to clipboard
	- Download rendered QR output
- Dashboard and tracking:
	- Save QR codes to a personal library (owner-only dashboard)
	- Enable scan tracking per QR — generates a short URL (`/r/:shortCode`)
	- View per-QR scan stats: total scan count, last scanned timestamp, individual scan events
	- Search, rename, delete, and bulk-clear saved QRs
	- Animated scan-error page for failed or invalid redirects

## Architecture

- Frontend: React 18, TypeScript, Vite
- Styling/UI: Tailwind CSS + shadcn/ui + Radix primitives
- Routing: react-router-dom
- Data utilities: @tanstack/react-query (UI infra)
- QR rendering: qr-code-styling
- Data/Auth/Analytics: Firebase Auth + Firestore + Vercel Serverless

### Architecture Diagram

```mermaid
flowchart LR
	U[User Browser] --> UI[Index Page + Components]
	UI --> QR["QR Preview Engine<br/>qr-code-styling"]
	UI --> FA["Firebase Auth<br/>owner-only login"]
	UI --> FS["Firestore<br/>QR library"]
	UI --> DB["Dashboard<br/>/dashboard"]
	DB --> FS
	SC[Scanner] --> RT["/r/:shortCode endpoint"]
	RT --> FS
	RT --> TG[Target URL]
	RT --> SE["ScanError Page<br/>/scan-error"]
```

## Project Structure

- src/pages/Index.tsx: Main QR builder screen and state orchestration
- src/pages/Dashboard.tsx: Saved QR library with scan analytics, search, and management actions
- src/pages/ScanError.tsx: Animated error page for failed or invalid scan redirects
- src/components/QRTypeSelector.tsx: QR type selector
- src/components/QRStyleTabs.tsx: Content + style controls
- src/components/QRPreview.tsx: Live QR render and download pipeline
- src/components/ThemePresets.tsx: Built-in and custom theme handling
- src/components/PrivateAppGate.tsx: Owner-only Google auth gate
- src/lib/firestoreQrCodes.ts: Firestore CRUD for saved QR library and scan events
- src/lib/savedQrCodes.ts: SavedQRCode type definitions and helpers
- src/lib/authOwner.ts: Owner UID resolution helper
- api/r/[shortCode].ts: Scan tracking redirect endpoint

### Repository Map

```mermaid
flowchart TD
	R[qr-canvas]

	R --> SRC[src]
	SRC --> PAGES["pages/"]
	PAGES --> IDX["Index.tsx<br/>main app state + layout"]
	PAGES --> DASH["Dashboard.tsx<br/>QR library + scan analytics"]
	PAGES --> SERR["ScanError.tsx<br/>failed redirect error page"]
	SRC --> COMP["components/<br/>UI + feature controls"]
	COMP --> QRT[QRTypeSelector.tsx]
	COMP --> QRS[QRStyleTabs.tsx]
	COMP --> QRP[QRPreview.tsx]
	COMP --> THM[ThemePresets.tsx]
	SRC --> GATE["components/<br/>PrivateAppGate.tsx"]
	SRC --> LIB["lib/"]
	LIB --> FBLIB["firestoreQrCodes.ts<br/>Firestore CRUD + scan events"]
	LIB --> SQR["savedQrCodes.ts<br/>type definitions"]
	LIB --> AUTH["authOwner.ts<br/>owner UID helper"]

	R --> API["api/r/[shortCode].ts<br/>scan tracking redirect"]
	R --> RULES[firestore.rules]

	R --> CFG["Config Files<br/>vite + tsconfig + eslint + tailwind"]
```

## Requirements

Minimum:

- Node.js 20+
- npm 10+
- Git

## Installation

```bash
git clone <your-repo-url>
cd qr-canvas
npm install
```

## Run Locally

For development with UI-only features:

```bash
npm run dev
```

Open http://localhost:8080.

To test QR code redirects and scan tracking locally, use `vercel dev` (emulates Vercel serverless environment):

```bash
npm i -g vercel
vercel dev
```

Then open http://localhost:3000.

## Environment Variables

Frontend:

- VITE_LOGO_DEV_PUBLISHABLE_KEY
	- Optional; enables logo.dev lookup mode
- VITE_PRIVATE_MODE
	- Optional; set to `true` to enforce owner-only login gate
- VITE_OWNER_EMAIL
	- Required when `VITE_PRIVATE_MODE=true`; only this email can sign in
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
	- Required for Google Auth + Firestore saved QR dashboard

Vercel Serverless Function (`/r/:shortCode` tracking redirect):

- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- SCAN_IP_HASH_SALT

## NPM Scripts

```bash
npm run dev         # local dev server (port 8080)
npm run build       # production build
npm run build:dev   # development-mode build
npm run preview     # preview dist build
npm run lint        # eslint
npm run test        # run vitest once
npm run test:watch  # vitest watch mode
```

## Private Deployment (Owner-Only Access)

If you deploy to Vercel and want only yourself to use the app:

1. In Firebase Auth settings:
- Enable Google sign-in provider.
- Add your Vercel production URL to authorized domains.

2. In Vercel project environment variables:
- `VITE_PRIVATE_MODE` = `true`
- `VITE_OWNER_EMAIL` = your personal email address
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SCAN_IP_HASH_SALT`

3. (Recommended extra lock) Enable Vercel deployment protection:
- Turn on Vercel Password Protection or Vercel Authentication.

With this enabled, the app is blocked unless the signed-in Google user email exactly matches `VITE_OWNER_EMAIL`.

## Firestore Security Rules (Single Owner)

This repo includes strict rules in [firestore.rules](firestore.rules) that lock data access to a single owner uid.

Collections protected by rules:

1. `app_config/private`
- One-time bootstrap owner config (`ownerUid`).

2. `users/{uid}/qrs/{qrId}`
- Only the owner uid can read/write QR documents.

3. `users/{uid}/qrs/{qrId}/scans/{scanId}`
- Owner can read only.
- Client writes are blocked; server-side Admin SDK writes scan events.

4. `qr_routes/{shortCode}`
- Owner-only read/write for tracking route mappings.

Deploy rules from CLI (optional but recommended):

```bash
npm i -g firebase-tools
firebase login
firebase use <your-firebase-project-id>
firebase deploy --only firestore:rules
```

You can also paste [firestore.rules](firestore.rules) directly in Firebase Console:
Firestore Database -> Rules.

## Firebase Console Setup (Keys + .env)

Use this once to populate local `.env.local` and Vercel environment variables.

1. Create project and web app
- Firebase Console -> Add project.
- Project Overview -> Add app -> Web.
- Copy SDK config values.

2. Enable authentication
- Build -> Authentication -> Sign-in method.
- Enable Google provider.
- Add your domain(s) under Authorized domains:
	- `localhost`
	- your Vercel domain(s)

3. Enable Firestore
- Build -> Firestore Database -> Create database.
- Start in production mode.
- Deploy rules from [firestore.rules](firestore.rules).

4. Create service account for Vercel endpoint writes
- Project settings -> Service accounts -> Generate new private key.
- Use key fields for server env vars:
	- `project_id` -> `FIREBASE_PROJECT_ID`
	- `client_email` -> `FIREBASE_CLIENT_EMAIL`
	- `private_key` -> `FIREBASE_PRIVATE_KEY`

5. Local env file (`.env.local`)

```bash
VITE_PRIVATE_MODE=true
VITE_OWNER_EMAIL=your-email@example.com

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SCAN_IP_HASH_SALT=<long-random-secret>
```

6. Restart dev server
- After editing env files, restart `npm run dev`.

## Scan Tracking Pipeline

To track public scans while keeping creator access private:

1. Save a QR in dashboard; trackable types receive a short URL (`/r/:shortCode`).
2. QR scanners open that short URL.
3. Vercel serverless function logs scan metadata to Firestore and redirects to the original target URL.

Captured fields include timestamp, visitor cookie ID, user agent, referrer, country/region/city (when available), and hashed IP prefix.

## Troubleshooting

1. Env var changes are ignored
- Restart `npm run dev` after editing env files. Also restart `vercel dev` if testing redirects.

2. Port 8080 conflict
- Stop the conflicting process or update Vite port in `vite.config.ts`.

3. Firebase Auth not working / redirect loop
- Ensure your domain is added to Firebase Console under Authentication → Settings → Authorized domains.
- For localhost: add `localhost` explicitly.
- For deployed app: add your Vercel domain.

4. "Permission denied" when saving or viewing QRs
- Ensure Firestore rules are deployed from [firestore.rules](firestore.rules).
- Verify `VITE_FIREBASE_PROJECT_ID` matches your Firebase project.
- Check that you're signed in with the correct owner email (if `VITE_PRIVATE_MODE=true`).

5. Scan redirects not working (visits `/scan-error`)
- If testing locally with `npm run dev`: redirects are not available; use `vercel dev` to emulate serverless functions.
- Ensure `FIREBASE_PRIVATE_KEY` is set in Vercel environment and has newlines preserved (`"...\n...\n..."`), not escaped.
- Verify `firestore.rules` allows admin writes to `qr_routes/{shortCode}` and `users/{uid}/qrs/{qrId}/scans/{scanId}`.

## Performance Note

Production build may show large chunk warnings due to bundled assets and font data. This does not block local usage. 

Additional considerations:
- **Dashboard pagination**: If you save many QRs (100+), consider paginating the dashboard to reduce initial render cost.
- **Firestore costs**: Each QR save, delete, or scan event writes to Firestore. Monitor usage in Firebase Console if approaching free-tier limits.
- **Font on-demand loading**: Scan label fonts are loaded only when applied; this keeps the initial bundle lean.

If needed, optimize further with route/code splitting and manual chunking.

## Development Notes

- This project intentionally supports a local-first workflow.
- **UI-only development**: Use `npm run dev` for rapid iteration on components and styles.
- **Testing redirects and dashboard**: Use `vercel dev` to emulate the Vercel serverless environment, enabling the `/r/:shortCode` redirect endpoint and Firestore writes.
- **Firebase & Firestore are required** for save, tracking, and analytics features. UI works without them, but those features will fail.
- **React Router** is used for multi-page navigation (Index, Dashboard, ScanError, NotFound). All routes are protected by `PrivateAppGate` when `VITE_PRIVATE_MODE=true`.
- Deployment to Vercel is optional and recommended for testing redirects, but not required for local UI development.
- Supabase integration was removed in this branch; Firebase/Firestore is now the persistent store.
