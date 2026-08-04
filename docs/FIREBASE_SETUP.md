# Firebase Setup

## 1. Create a project

Go to the [Firebase console](https://console.firebase.google.com/) and create a project (e.g. `mk-store-app`). Enable the Blaze or Spark plan (Spark is sufficient for V2 development and small stores).

## 2. Enable services

From the console, enable in this project:

- **Authentication** → Sign-in method → Email/Password = ON.
- **Firestore Database** → Create database (start in `__schell__`? no — in **test mode**, then lock down with the provided `firestore.rules`). Set location to your region.
- **Storage** → Create a bucket.
- **Functions** → enable.
- **Hosting** → enable.

## 3. Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use mk-store-app
```

The `.firebaserc` in this repo pins the project id:

```json
{ "projectId": "mk-store-app", "appId": "mk-store-app" }
```

## 4. Environment

Copy `.env.example` → `.env.local` and fill in your **public** Firebase config (all keys are safe to embed in the client — they do not authenticate anything; security is enforced by Firestore/Storage **Rules**).

```bash
cp .env.example .env.local
```

For local development, set `VITE_FIREBASE_USE_EMULATOR=true` and run the emulators (see below).

## 5. Emulators (local)

First install the Functions dependencies:

```bash
cd functions && npm install
```

Then from the repo root:

```bash
firebase emulators:start
```

This starts: Auth (9099), Firestore (8080), Functions (5099), Storage (9199), Hosting (5000) and the Emulator UI (4000).

With `VITE_FIREBASE_USE_EMULATOR=true` the frontend automatically connects to these local endpoints (see `src/shared/firebase/index.ts`).

## 6. Deploy rules & indexes (production)

```bash
firebase deploy --only firestore,storage
firebase deploy --only firestore:indexes   # first-time
```

## 7. Deploy Hosting + Functions

```bash
npm run build
firebase deploy
```

Hosting serves the prebuilt `dist/` (`firebase.json` → `"public": "dist"`), and rewrites all non-asset URLs to `/index.html` for client-side routing.

## Emulator notes

- Functions written with `firebase-functions/v2/https` (`onCall`) deploy and run identically locally and in production.
- The Auth emulator lets you create users without real passwords; use the Emulator UI at `http://localhost:4000/auth`.
- Firestore rules are enforced against the **emulator** as well, so local testing is realistic.
