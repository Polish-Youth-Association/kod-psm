import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post('/api/log', (req, res) => {
  console.log('📥 /api/log payload:', req.body);
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'member-onboarding' });
});

app.listen(PORT, () => {
  console.log(`🚀 member-onboarding backend running on port ${PORT}`);
});