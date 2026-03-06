import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import type { Request, Response } from 'express';

const openaiKey = defineSecret('OPENAI_API_KEY');

const ALLOWED_ORIGINS = [
  'https://vector-app-dee90.web.app',
  'https://vector-app-dee90.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
];

function setCors(req: Request, res: Response): boolean {
  const origin = (req.headers.origin as string) ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

/**
 * POST /api/openai
 * Body: { prompt?, messages?, model?, temperature?, max_tokens? }
 * Returns: { text }
 */
export const openai = onRequest({ secrets: [openaiKey] }, async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    prompt,
    messages,
    model = 'gpt-4o-mini',
    temperature = 0.7,
    max_tokens,
  } = req.body as {
    prompt?: string;
    messages?: { role: string; content: string }[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };

  const msgs = messages ?? (prompt ? [{ role: 'user', content: prompt }] : null);
  if (!msgs) {
    res.status(400).json({ error: 'prompt or messages is required' });
    return;
  }

  try {
    const body: Record<string, unknown> = { model, messages: msgs, temperature };
    if (max_tokens) body.max_tokens = max_tokens;

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey.value()}`,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json() as {
      error?: { message: string };
      choices: { message: { content: string } }[];
    };
    if (data.error) throw new Error(data.error.message);

    res.json({ text: data.choices[0].message.content.trim() });
  } catch (err) {
    console.error('[openai]', err);
    res.status(502).json({ error: String(err) });
  }
});

/**
 * POST /api/openai-image
 * Body: { prompt, size?, quality?, output_format? }
 * Returns: { b64 }
 */
export const openaiImage = onRequest({ secrets: [openaiKey] }, async (req, res) => {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    prompt,
    size = '1024x1024',
    quality = 'high',
    output_format = 'png',
  } = req.body as {
    prompt?: string;
    size?: string;
    quality?: string;
    output_format?: string;
  };

  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey.value()}`,
      },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size, quality, output_format }),
    });

    const data = await upstream.json() as {
      error?: { message: string };
      data?: { b64_json?: string }[];
    };
    if (data.error) throw new Error(data.error.message);

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image data missing from response');

    res.json({ b64 });
  } catch (err) {
    console.error('[openaiImage]', err);
    res.status(502).json({ error: String(err) });
  }
});
