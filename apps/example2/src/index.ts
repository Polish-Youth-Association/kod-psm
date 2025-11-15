import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'example2',
  });
});

app.listen(PORT, () => {
  console.log('🚀 example2 (example2) running on port ' + PORT);
});
