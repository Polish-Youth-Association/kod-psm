# @kod-psm/http-helpers

Shared library that provides a standardised Express app factory and middleware stack. Used by all Express-based services in the monorepo.

## Usage

```typescript
import { createApp, listen } from '@kod-psm/http-helpers';

const app = createApp((router) => {
  router.get('/', (_req, res) => res.json({ ok: true, service: 'my-service' }));
  router.post('/v1/something', async (req, res) => { ... });
});

listen(app, PORT, () => console.log('running on port ' + PORT));
```

## Important: `createApp` callback receives `Application`, not `Router`

The `RegisterRoutes` type is `(app: Application) => void`. The parameter is the full Express app — you can call `router.get()`, `router.post()`, etc. directly on it. Do NOT import `Router` from this lib and use it as a separate router instance.

Do NOT add explicit `Request`/`Response` type annotations to route handlers — TypeScript infers them correctly from the callback signature.

## Exports

| Export | Description |
|--------|-------------|
| `createApp(registerRoutes)` | Creates an Express app with standard middleware pre-wired |
| `listen(app, port?, onListening?)` | Starts the server on `0.0.0.0:port` |
| `Router` | Re-export from Express |
| `json` | Re-export from Express |
| `urlencoded` | Re-export from Express |
| `Application` | TypeScript type re-export from Express |

## Middleware (wired automatically by `createApp`)

1. `express.json()` — JSON body parsing
2. `requestId()` — reads `x-request-id` header or generates a UUID; attaches to `req.requestId` and sets it on the response
3. Your routes (via the `registerRoutes` callback)
4. `notFound()` — returns `{ ok: false, error: 'Not Found', path }` for unmatched routes
5. `errorHandler()` — catches thrown errors, logs them with `requestId`, returns `{ ok: false, error, requestId }`

## Building

```bash
pnpm --filter @kod-psm/http-helpers run build
```

Services that depend on this lib have it in their pnpm filter chain (`--filter "@kod-psm/<service>..."`), so it gets built automatically before the service.
