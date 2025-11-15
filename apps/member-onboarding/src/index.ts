import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'I Love Vicky!',
  });
});

app.listen(PORT, () => {
  console.log('🚀 member-onboarding (member-onboarding) running on port ' + PORT);
});