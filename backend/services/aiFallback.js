// services/aiFallback.js
const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY (set it in Render → Environment)');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askOpenAI(input) {
  let messages;

  if (Array.isArray(input?.messages)) {
    messages = input.messages;
  } else {
    messages = [
      { role: 'system', content: "You are Moti's portfolio bot. Keep answers concise; add links only if asked." },
      { role: 'user', content: String(input || '') }
    ];
  }

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 300
  });

  return (resp.choices?.[0]?.message?.content || '').trim();
}

module.exports = { askOpenAI };
