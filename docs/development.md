# Development workflow

## Install
From repo root:
```
pnpm install
```

## Run the portal locally
```
pnpm --filter @kod-psm/psm-portal run dev
```
Set `NEXT_PUBLIC_WIX_FUNCTIONS_BASE` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to talk to a backend.

## Build
```
pnpm --filter @kod-psm/psm-portal run build   # static export -> apps/psm-portal/out
```

## Environment variables
- Local values go in `apps/psm-portal/.env.local`.
- Do not commit `.env` files.

## Backend
The Velo backend in `wix-velo/` runs inside the Wix site. See `wix-velo/README.md` for syncing it.
