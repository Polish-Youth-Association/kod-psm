import { createApp, listen } from '@kod-psm/http-helpers';

const PORT = Number(process.env.PORT) || 8080;

const app = createApp((router) => {
  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'example',
    });
  });
});

listen(app, PORT, () => {
  console.log('🚀 example (example) running on port ' + PORT);
});
