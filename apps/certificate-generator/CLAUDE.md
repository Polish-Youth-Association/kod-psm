# certificate-generator

Express backend that generates PDF membership certificates and stores them in Google Cloud Storage (or locally in dev).

## Stack

- Express, pdf-lib, pdfkit, `@pdf-lib/fontkit`, `@kod-psm/gcp-helpers`, TypeScript

## Dev

```bash
pnpm --filter @kod-psm/certificate-generator run dev   # http://localhost:8080
```

Requires a `.env` file:
```bash
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket-name   # optional locally — falls back to filesystem
```

When `GCP_BUCKET_NAME` is not set or `K_SERVICE` is not present (i.e. not on Cloud Run), files are saved locally instead of GCS.

## API Endpoints

### `GET /`
Health check: `{ ok: true, service: 'certificate-generator' }`.

### `POST /generate-certificate`

Generates a PDF certificate for a member.

**Request body:**
```typescript
{
  memberId: string    // required
  firstName: string   // required
  lastName: string    // required
}
```

**Response:**
```typescript
{
  ok: true,
  message: string,
  certificateId: string,
  backend: 'gcs' | 'local',
  objectPath: string,
  url?: string        // set when backend is 'gcs'
  localPath?: string  // set when backend is 'local'
}
```

## Storage

Uses `initStorage()` from `@kod-psm/gcp-helpers`. Auto-detects Cloud Run via the `K_SERVICE` env var:
- **Cloud Run + `GCP_BUCKET_NAME` set** → saves to Google Cloud Storage at `gs://{bucket}/{objectPath}`
- **Locally or bucket not set** → saves to local filesystem

## PDF Generation

Uses `pdf-lib` and `pdfkit` with `@pdf-lib/fontkit` for custom font embedding. The PDF template and font assets live in the `assets/` directory (or similar — check `src/index.ts` for exact paths).
