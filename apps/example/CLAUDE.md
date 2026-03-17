# example

Minimal scaffold service used as a reference when creating new apps. Not a real service — exists to demonstrate the standard Express + `@kod-psm/http-helpers` setup.

## When creating a new service

Copy this app or run `pnpm create:app` from the monorepo root. Key things to set up:
1. `package.json` — set `name` to `@kod-psm/<service-name>`
2. `src/index.ts` — use `createApp` + `listen` from `@kod-psm/http-helpers`
3. `Dockerfile` — follow the pattern in `apps/volunteer-onboarding/Dockerfile` (filter install, not root build)
4. `infra/apps.yaml` — add an entry with `id`, `name`, `path`, `region`, `artifactRepo`
5. `iam.yaml` — define the Cloud Run service account and IAM roles

## Dev

```bash
pnpm --filter @kod-psm/example run dev   # http://localhost:8080
```

## Endpoint

`GET /` → `{ ok: true, service: "PING!" }`
