// backend/llm.js
// Chat assistant backend — open-weights model via Groq's free, OpenAI-compatible API.
// Replaces the former Gemini implementation. GROQ_API_KEY lives in Wix Secrets Manager.
//
// The exposed `chat(history, message)` contract is unchanged, so the frontend and the
// /_functions/chat handler need no changes if you ever swap the model or provider again.

import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';

// Groq-hosted open model. Swap freely: 'llama-3.1-8b-instant' (faster/cheaper),
// 'qwen/qwen3-32b', 'deepseek-r1-distill-llama-70b', etc. — all OpenAI-compatible.
const MODEL = 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  'You are a helpful internal assistant for the Polish Youth Association ' +
  '(PSM — Polskie Stowarzyszenie Młodzieżowe). You help staff and volunteers with questions ' +
  'about member onboarding, volunteer processes, events, and general PSM operations. ' +
  'Be concise and friendly.';

/**
 * @param {{ role: string, text: string }[]} history  roles are 'user' | 'model' (frontend shape)
 * @param {string} message
 * @returns {Promise<{ ok: boolean, reply?: string, error?: string }>}
 */
export async function chat(history = [], message = '') {
  if (!message || !message.trim()) {
    return { ok: false, error: 'message is required' };
  }

  const apiKey = await getSecret('GROQ_API_KEY');
  if (!apiKey) return { ok: false, error: 'GROQ_API_KEY is not set' };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text,
    })),
    { role: 'user', content: message.trim() },
  ];

  const resp = await fetch(ENDPOINT, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.6 }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const errMsg = data && data.error ? data.error.message : `HTTP ${resp.status}`;
    return { ok: false, error: errMsg };
  }

  const reply =
    (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  return { ok: true, reply };
}
