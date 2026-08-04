# Deployment

## Local dev (emulators)

```bash
npm install
cd functions && npm install

# frontend
npm run dev                    # http://localhost:5173 (proxies not needed; direct Firestore)

# full backend emulation
firebase emulators:start       # Auth 9099, Firestore 8080, Functions 5099,
                               # Storage 9199, Hosting 5000, UI 4000
```

Set `VITE_FIREBASE_USE_EMULATOR=true` in `.env.local` so the frontend connects to the emulators (see `src/shared/firebase/index.ts`).

### Seed the first platform admin

There is no super-admin by default. Create one via the Auth emulator UI, then assign the role in the Firestore emulator:

```bash
firebase firestore:set 'users/{uid}' '{
  "uid": "<UID>",
  "email": "admin@mk.local",
  "name": "Super Admin",
  "role": "platformAdmin",
  "storeIds": [],
  "active": true
}' -- emulators
```

(Or use the Emulator UI at http://localhost:4000/firestore to add a `users` document with `role: "platformAdmin"`.)

## Production deploy

```bash
npm run build
firebase deploy
```

`firebase deploy` deploys in the right order: Firestore rules → indexes → Functions → Hosting. First-time only, the emulator may warn about missing indexes; create them and re-deploy with:

```bash
firebase deploy --only firestore:indexes
```

## CI / GitHub Actions (optional)

```yaml
# .github/workflows/deploy.yml
- run: npm ci
- run: cd functions && npm ci
- run: npm run build
- run: npx firebase deploy --token "$FIREBASE_TOKEN"
```

Generate a deploy token once with `firebase login:ci`.

## Spark → Blaze upgrade path

Spark Free limits (2026): 50 k reads / 20 k writes / 20 k deletes **per day**, and **no scheduled or background functions**. The V2 architecture is Spark-compatible:

- Analytics are denormalized (written, not recomputed).
- No cron jobs — nothing depends on scheduled triggers.
- Order numbers use a Firestore counter transaction (works on Spark).

When traffic grows, the recommended upgrades are:

1. **Blaze plan** — unlocks scheduled functions and higher quotas.
2. Add a scheduled function (e.g. `computeDailyAnalytics`) to pre-aggregate per-store analytics and reset the daily write count.
3. Enable **App Check** to block abused clients.
4. Move the `analytics` doc into a separate collection to distribute writes.
5. Consider Firestore **codeless** indexes auto-management.

## Custom domain

Add your domain in the Hosting console, then:

```bash
firebase hosting:channel:deploy <channel>
```

The `firebase.json` Hosting config rewrites all non-asset routes to `/index.html`, so deep links into `/platform`, `/merchant`, or `/store/:slug` resolve correctly on refresh.
