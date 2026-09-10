# Production Hosting rollback

Use this runbook only for a failed Firebase Hosting release. A Firebase CLI exit code of zero is not sufficient evidence that the release is healthy.

## Identify the last stable release

1. Use the release evidence from the last successful `deploy:production` run. It must show all three `POST_DEPLOY` routes passing with zero page errors and zero fatal console errors.
2. Record the Git commit used by that release. Do not select a commit merely because its Firebase deploy command succeeded.
3. Check whether the validated release was preserved in the `rollback-stable` Hosting channel:

   ```bash
   firebase hosting:channel:list --project mk-store-app --site mk-store-app
   ```

The installed Firebase CLI (`firebase-tools 15.25.1`) supports `hosting:channel:list`, `hosting:channel:deploy`, and `hosting:clone`. It does not expose a command that selects an arbitrary historical live release by release number, so this runbook does not invent one.

## Preferred rollback: preserved stable channel

The `rollback-stable` channel must contain a release that already passed the production bundle browser gate. Promote it to live with the CLI-supported clone operation:

```bash
firebase hosting:clone mk-store-app:rollback-stable mk-store-app:live --project mk-store-app
```

Do not clone an unverified preview channel. Before each future production release, preserve the currently verified live bundle in `rollback-stable`; never overwrite that channel while live is unhealthy.

## Fallback rollback: rebuild the verified Git commit

If no verified stable channel exists, create an isolated worktree at the recorded stable commit, then run:

```bash
npm ci
npm run typecheck
npm run build -- --mode production
npm run verify:production-runtime
firebase deploy --project mk-store-app --only hosting
npm run verify:production-live
```

Stop if any pre-deploy check fails. Report `PRODUCTION_RELEASE_FAILED` if the final browser smoke fails, even when Firebase reports a successful upload.

## Functions and rules

Do not roll back Functions, Firestore indexes/rules, or Storage rules for a Hosting-only rendering outage. Rolling back backend resources can break data contracts or remove migrations required by existing data. Consider a backend rollback only when the incident is proven to originate there and compatibility with current production data has been reviewed separately.

## Verify after rollback

The rollback is complete only after a real-browser check passes for:

- `https://mtjari.shop/`
- `https://mtjari.shop/login`
- `https://mtjari.shop/register`

The check must show visible application content, no blank page, no ErrorBoundary fallback, zero `pageerror` events, and zero fatal console errors. If a QA browser storage state is configured, the read-only merchant dashboard smoke must also pass. Do not create orders, shipments, payments, or any other production data during rollback verification.
