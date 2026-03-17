# @kod-psm/gcp-helpers

Shared library that provides a Google Cloud Storage abstraction with automatic local filesystem fallback for development.

## Usage

```typescript
import { initStorage } from '@kod-psm/gcp-helpers';

const storage = initStorage({
  bucketName: process.env.GCP_BUCKET_NAME,
  projectId: process.env.GCP_PROJECT_ID,
  localBaseDir: path.join(__dirname, '../local-storage'),
});

const result = await storage.saveFile(
  pdfBuffer,
  'certificates/PSM-2024-001.pdf',
  'application/pdf',
  { memberId: 'PSM-2024-001' }
);

// result.backend === 'gcs' | 'local'
// result.url       — set when backend is 'gcs'
// result.localPath — set when backend is 'local'
```

## Backend Detection

`initStorage()` checks the `K_SERVICE` environment variable (automatically set by Cloud Run) to decide which backend to use:

| Condition | Backend |
|-----------|---------|
| `K_SERVICE` is set AND `bucketName` is provided | Google Cloud Storage |
| Otherwise | Local filesystem (under `localBaseDir`) |

This means local dev always uses the filesystem backend — no GCS credentials or bucket needed.

## `initStorage(config)` Config

```typescript
{
  bucketName?: string    // GCS bucket name
  projectId?: string     // GCP project ID
  localBaseDir: string   // absolute path for local fallback storage
}
```

## `saveFile(buffer, objectPath, contentType?, metadata?)` Return Value

```typescript
{
  backend: 'gcs' | 'local',
  objectPath: string,
  url?: string        // "https://storage.googleapis.com/{bucket}/{objectPath}" — GCS only
  localPath?: string  // absolute filesystem path — local only
}
```

## Dependencies

- `@google-cloud/storage` — GCS client (only used when on Cloud Run)

## Building

```bash
pnpm --filter @kod-psm/gcp-helpers run build
```
