// testOpenAI.js
require('dotenv').config();
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  const resp = await client.responses.create({
    model: "gpt-4o",
    input: [{ role: "user", content: "Say 'pong'." }],
    max_output_tokens: 20
  });
  console.log("OpenAI says:", resp.output_text?.trim());
})();
