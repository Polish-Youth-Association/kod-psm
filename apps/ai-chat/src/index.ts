import 'dotenv/config';
import { createApp, listen } from '@kod-psm/http-helpers';
import { initFirestore } from '@kod-psm/gcp-helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const PORT = Number(process.env.PORT) || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are a helpful internal assistant for the Polish Youth Association (PSM — Polskie Stowarzyszenie Młodzieżowe). You help staff and volunteers with questions about member onboarding, volunteer processes, events, and general PSM operations. Be concise and friendly.`;

const db = initFirestore({ databaseId: 'psm-chat-sessions' });

type MessageRecord = {
  role: 'user' | 'model';
  text: string;
  createdAt: Timestamp;
};

type SessionDoc = {
  userEmail: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  messages: MessageRecord[];
};

function sessionTitle(firstMessage: string): string {
  return firstMessage.slice(0, 60).trim();
}

async function callGemini(
  history: { role: string; text: string }[],
  message: string,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} } as any],
  });

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.text }],
    })),
  });

  const result = await chat.sendMessage(message);
  return result.response.text();
}

const app = createApp((router) => {
  router.get('/', (_req, res) => {
    res.json({ ok: true, service: 'ai-chat' });
  });

  // List sessions for a user (newest first)
  router.get('/v1/sessions', async (req, res) => {
    const userEmail = req.query.userEmail as string;
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: 'userEmail query param required' });
    }

    try {
      const snap = await db
        .collection('sessions')
        .where('userEmail', '==', userEmail)
        .orderBy('updatedAt', 'desc')
        .limit(20)
        .get();

      const sessions = snap.docs.map((d) => {
        const data = d.data() as SessionDoc;
        return {
          sessionId: d.id,
          title: data.title,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });

      return res.json({ ok: true, sessions });
    } catch (err: any) {
      console.error('list sessions error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // Get a single session with full messages
  router.get('/v1/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const userEmail = req.query.userEmail as string;
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: 'userEmail query param required' });
    }

    try {
      const snap = await db.collection('sessions').doc(sessionId).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: 'session not found' });

      const data = snap.data() as SessionDoc;
      if (data.userEmail !== userEmail) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      return res.json({ ok: true, session: { sessionId, ...data } });
    } catch (err: any) {
      console.error('get session error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // Create a new session with the first message
  router.post('/v1/sessions', async (req, res) => {
    const { userEmail, message } = (req.body ?? {}) as { userEmail?: string; message?: string };
    if (!userEmail || !message?.trim()) {
      return res.status(400).json({ ok: false, error: 'userEmail and message are required' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not set' });
    }

    try {
      const text = message.trim();
      const reply = await callGemini([], text);
      const now = Timestamp.now();

      const sessionRef = db.collection('sessions').doc();
      await sessionRef.set({
        userEmail,
        title: sessionTitle(text),
        messages: [
          { role: 'user', text, createdAt: now },
          { role: 'model', text: reply, createdAt: now },
        ],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return res.status(201).json({
        ok: true,
        sessionId: sessionRef.id,
        title: sessionTitle(text),
        reply,
      });
    } catch (err: any) {
      console.error('create session error:', err);
      return res.status(502).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // Send a message in an existing session
  router.post('/v1/sessions/:sessionId/messages', async (req, res) => {
    const { sessionId } = req.params;
    const { userEmail, message } = (req.body ?? {}) as { userEmail?: string; message?: string };
    if (!userEmail || !message?.trim()) {
      return res.status(400).json({ ok: false, error: 'userEmail and message are required' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not set' });
    }

    try {
      const sessionRef = db.collection('sessions').doc(sessionId);
      const snap = await sessionRef.get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: 'session not found' });

      const data = snap.data() as SessionDoc;
      if (data.userEmail !== userEmail) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      const text = message.trim();
      const history = data.messages.map((m) => ({ role: m.role, text: m.text }));
      const reply = await callGemini(history, text);
      const now = Timestamp.now();

      await sessionRef.update({
        messages: [
          ...data.messages,
          { role: 'user', text, createdAt: now },
          { role: 'model', text: reply, createdAt: now },
        ],
        updatedAt: FieldValue.serverTimestamp(),
      });

      return res.json({ ok: true, reply });
    } catch (err: any) {
      console.error('send message error:', err);
      return res.status(502).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  // Delete a session
  router.delete('/v1/sessions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { userEmail } = (req.body ?? {}) as { userEmail?: string };
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: 'userEmail is required' });
    }

    try {
      const sessionRef = db.collection('sessions').doc(sessionId);
      const snap = await sessionRef.get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: 'session not found' });

      const data = snap.data() as SessionDoc;
      if (data.userEmail !== userEmail) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }

      await sessionRef.delete();
      return res.json({ ok: true });
    } catch (err: any) {
      console.error('delete session error:', err);
      return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });
});

listen(app, PORT, () => {
  console.log('ai-chat running on port ' + PORT);
});
