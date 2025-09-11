// services/aiFallback.js
require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askOpenAI(userQuestion) {
  const resp = await client.responses.create({
    model: "gpt-4o",
    instructions: "You are Moti's portfolio bot. Keep answers concise; add links only if asked.",
    input: [{ role: "user", content: userQuestion }],
    max_output_tokens: 300
  });
  return (resp.output_text || "").trim();
}

module.exports = { askOpenAI };
