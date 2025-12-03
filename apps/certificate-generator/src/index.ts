import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'certificate-generator',
  });
});

app.listen(PORT, () => {
  console.log('🚀 Certificate-Generator (certificate-generator) running on port ' + PORT);
});
