import { createApp, listen } from '@kod-psm/http-helpers';

const PORT = Number(process.env.PORT) || 8080;
const EXAMPLE_URL = process.env.EXAMPLE_URL ?? 'https://example-538357547406.us-central1.run.app';

async function callExample() {
  const metadataUrl =
    'http://metadata/computeMetadata/v1/instance/service-accounts/default/identity' +
    `?audience=${encodeURIComponent(EXAMPLE_URL)}`;

  const tokenResp = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' }, // required on Cloud Run
  });

  if (!tokenResp.ok) {
    throw new Error(`Failed to fetch ID token: ${await tokenResp.text()}`);
  }

  const idToken = await tokenResp.text();

  const resp = await fetch(EXAMPLE_URL, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!resp.ok) {
    throw new Error(`Example service error: ${resp.status} ${await resp.text()}`);
  }

  return resp.json();
}

const app = createApp((router) => {
  router.get('/proxy-example', async (_req, res, next) => {
    try {
      const data = await callExample();
      res.json({ ok: true, via: 'example2', data });
    } catch (err) {
      next(err);
    }
  });
});

listen(app, PORT, () => console.log(`example2 listening on ${PORT}`));
