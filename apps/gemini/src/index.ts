import 'dotenv/config';
import { createApp, listen } from '@kod-psm/http-helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PORT = Number(process.env.PORT) || 8080;

const SYSTEM_PROMPT = `You are a helpful internal assistant for the Polish Youth Association (PSM — Polska Szkoła Muzyczna / Polskie Stowarzyszenie Młodzieżowe). You help staff and volunteers with questions about member onboarding, volunteer processes, events, and general PSM operations. Be concise and friendly.`;

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('GEMINI_API_KEY is not set — /v1/chat will return 500');
}

const app = createApp((router) => {
  router.get('/', (_req, res) => {
    res.json({ ok: true, service: 'gemini' });
  });

  router.post('/v1/chat', async (req, res) => {
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not set' });
    }

    const { history = [], message } = (req.body ?? {}) as {
      history?: { role: string; text: string }[];
      message?: string;
    };

    if (!message?.trim()) {
      return res.status(400).json({ ok: false, error: 'message is required' });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }],
      });

      const chat = model.startChat({
        history: history.map((m) => ({
          role: m.role as 'user' | 'model',
          parts: [{ text: m.text }],
        })),
      });

      const result = await chat.sendMessage(message.trim());
      const reply = result.response.text();

      return res.json({ ok: true, reply });
    } catch (err: any) {
      console.error('Gemini error:', err);
      return res.status(502).json({ ok: false, error: err?.message ?? String(err) });
    }
  });
});

listen(app, PORT, () => {
  console.log('gemini service running on port ' + PORT);
});
