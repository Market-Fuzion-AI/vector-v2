import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

const MAKE_WEBHOOK = 'https://hook.us2.make.com/0vlg784ilbtq7k5ylrgxecfpea7re4n';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

// ── Publish proxy (avoids browser CORS on Make.com) ─────────────────────────
app.post('/api/publish', async (req, res) => {
  const { platform, title, hook, caption, cta, hashtags, imageUrl } = req.body as {
    platform?: string;
    title?: string;
    hook?: string;
    caption?: string;
    cta?: string;
    hashtags?: string[];
    imageUrl?: string;
  };

  try {
    const response = await fetch(MAKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, title, hook, caption, cta, hashtags, imageUrl }),
    });

    if (!response.ok) {
      throw new Error(`Make webhook responded with ${response.status}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/publish]', err);
    res.status(502).json({ ok: false, error: String(err) });
  }
});

// ── OpenAI chat completions proxy ────────────────────────────────────────────
app.post('/api/openai', async (req, res) => {
  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not set in .env' });
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
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
    console.error('[/api/openai]', err);
    res.status(502).json({ error: String(err) });
  }
});

// ── OpenAI image generation proxy ────────────────────────────────────────────
app.post('/api/openai-image', async (req, res) => {
  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not set in .env' });
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
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
    console.error('[/api/openai-image]', err);
    res.status(502).json({ error: String(err) });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
