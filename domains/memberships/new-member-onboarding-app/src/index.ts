import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('PSM New Member Onboarding – dev is alive');
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`new-member-onboarding-app listening on port ${port}`);
});

