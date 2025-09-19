// services/aiFallback.js
const OpenAI = require('openai');

// בדיקה מקדימה – אם אין מפתח, נדפיס שגיאה ברורה
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY (set it in Render → Environment)");
  // אפשר גם לזרוק שגיאה: throw new Error("Missing OPENAI_API_KEY");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askOpenAI(input) {
  let messages;

  // אם שולחים {messages}, ניקח אותם ישירות
  if (Array.isArray(input?.messages)) {
    messages = input.messages;
  } else {
    // אחרת נניח שזה string ונעטוף כהודעת user
    messages = [
      { role: "system", content: "You are Moti's portfolio bot. Keep answers concise; add links only if asked." },
      { role: "user", content: String(input || "") }
    ];
  }

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini", // אפשר גם "gpt-4o"
    messages,
    max_tokens: 300
  });

  return (resp.choices?.[0]?.message?.content || "").trim();
}

module.exports = { askOpenAI };
