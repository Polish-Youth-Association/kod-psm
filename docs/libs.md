# Libraries

The `libs/` directory contains shared, reusable code that can be consumed by apps
and other libs. Use libs to avoid copy-paste across services.

## What belongs here
- Reusable helpers and utilities
- Shared HTTP/Express middleware
- GCP/client wrappers
- Type definitions shared across apps
- Validation schemas or shared config objects

## What does not belong here
- App-specific business logic
- Code that only one app uses
- Secrets or environment-specific config
- Deployment scripts (use `infra/` or `scripts/`)

## Expectations for a lib
Each lib should include:
- `src/` with exported entry points
- `package.json` with `name`, `build`, and `types`
- `tsconfig.json` that emits declarations (`declaration: true`)

## Usage
Import libs via workspace names:
```
import { createApp } from '@kod-psm/http-helpers';
```

## Adding a new lib
1) Create `libs/<name>/src`.
2) Add `package.json` + `tsconfig.json`.
3) Export public APIs from `src/index.ts`.
4) Add it as a dependency using `workspace:*`.
