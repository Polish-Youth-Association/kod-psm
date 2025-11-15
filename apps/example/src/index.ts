import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'example',
  });
});

app.listen(PORT, () => {
  console.log('🚀 example (example) running on port ' + PORT);
});

//# The code above is from apps/example/src/index.ts