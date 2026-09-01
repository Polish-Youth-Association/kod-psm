// backend/gemini.js
// Port of apps/gemini (gemini-2.5-flash + Google Search grounding).
// Calls the Generative Language REST API directly via wix-fetch so we don't depend on the
// @google/generative-ai SDK inside Velo. GEMINI_API_KEY lives in Wix Secrets Manager.

import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT =
  'You are a helpful internal assistant for the Polish Youth Association ' +
  '(PSM — Polskie Stowarzyszenie Młodzieżowe). You help staff and volunteers with questions ' +
  'about member onboarding, volunteer processes, events, and general PSM operations. ' +
  'Be concise and friendly.';

/**
 * @param {{ role: string, text: string }[]} history
 * @param {string} message
 * @returns {Promise<{ ok: boolean, reply?: string, error?: string }>}
 */
export async function chat(history = [], message = '') {
  if (!message || !message.trim()) {
    return { ok: false, error: 'message is required' };
  }

  const apiKey = await getSecret('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY is not set' };

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: message.trim() }] },
  ];

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ google_search: {} }],
  };

  const resp = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const errMsg = data && data.error ? data.error.message : `HTTP ${resp.status}`;
    return { ok: false, error: errMsg };
  }

  const reply =
    (data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map((p) => p.text || '').join('')) ||
    '';

  return { ok: true, reply };
}
