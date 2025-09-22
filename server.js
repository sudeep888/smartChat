require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic rate limiter to reduce accidental abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json());
app.use(limiter);

// Serve static frontend (place index.html in public/)
app.use(express.static(path.join(__dirname, 'public')));

// Health-check
app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages) return res.status(400).json({ error: 'messages required in body' });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API key missing' });
    }

    const payload = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: Array.isArray(messages) ? messages : [{ role: 'user', content: String(messages) }],
      max_tokens: 512,
      temperature: 0.7,
    };

    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      // Forward the OpenAI error message but avoid echoing sensitive internals
      const errMsg = data?.error?.message || JSON.stringify(data);
      return res.status(apiRes.status).json({ error: errMsg });
    }

    // Success
    return res.json(data);
  } catch (err) {
    console.error('Server error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});