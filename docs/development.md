# Development workflow

## Install
From repo root:
```
pnpm install
```

## Build
Build all workspaces:
```
pnpm build
```

Build a single app:
```
pnpm --filter @kod-psm/<app> run build
```

## Run locally
Most apps expose:
```
pnpm --filter @kod-psm/<app> run dev
```

## Environment variables
- Local secrets go in an app-level `.env` file.
- Do not commit `.env` files.
- See `docs/secrets.md` for GCP Secret Manager workflow.

## Create a new app
```
pnpm create:app
```
See `docs/create-an-app.md` for details.
