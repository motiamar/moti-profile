// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { answerQuestion, findTopicMatch } = require('./index');
const { askOpenAI } = require('./services/aiFallback');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Conversation memory (per clientId) ===
const convoMemory = new Map(); // key: clientId -> [{role, content}]
const MAX_TURNS = 10;
function pushTurn(clientId, role, content) {
  if (!clientId) return;
  const arr = convoMemory.get(clientId) || [];
  arr.push({ role, content });
  while (arr.length > MAX_TURNS) arr.shift();
  convoMemory.set(clientId, arr);
}

// Healthcheck
app.get('/health', (_, res) => res.send('OK'));

// Optional: reset conversation
app.post('/reset', (req, res) => {
  const { clientId } = req.body || {};
  if (clientId) convoMemory.delete(clientId);
  res.json({ ok: true });
});

// === Suggestions builder ===
async function buildSuggestions({ history, question, answer, topic }) {
  const system = 'החזר JSON בלבד בתבנית {"suggestions":["...","..."]}. בלי טקסט נוסף.';
  const hints = [
    `שאלה אחרונה: ${question}`,
    `תשובת הבוט: ${answer}`,
    topic?.text ? `מידע רלוונטי מהפרופיל:\n${topic.text}` : ''
  ].filter(Boolean).join('\n\n');

  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: `תן 2-3 הצעות קצרות לשאלות המשך שמתאימות לשיחה הזו.\n${hints}` }
  ];

  try {
    const raw = await askOpenAI({ messages });  // askOpenAI תומך ב-messages
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.suggestions)) {
      return parsed.suggestions.slice(0, 4);
    }
  } catch (_) {
    // נרד לפולבק למטה
  }

  // Fallback פשוט אם לא חזר JSON תקין
  if (topic?.topic) {
    return [
      `תן דוגמה מתוך "${topic.topic}"`,
      `איך זה מחובר ל-Render?`,
      `אפשר קוד קצר?`
    ];
  }
  return [];
}

// === Main QA endpoint ===
app.post('/ask', async (req, res) => {
  try {
    const { question, clientId } = req.body || {};
    if (!question) return res.status(400).json({ error: 'No question provided' });

    // user turn -> memory
    pushTurn(clientId, 'user', question);

    // Local engine first
    let local = await Promise.resolve(answerQuestion(question));
    let localText = typeof local === 'string' ? local : local?.text;

    const needFallback =
      !localText ||
      !localText.trim() ||
      (typeof local === 'object' && (local.confidence === 'low' || local.code === 'NO_LOCAL_ANSWER')) ||
      /לא מצאתי תשובה|אין לי תשובה/i.test(localText);

    let finalText = localText;

    // conversation history for AI
    const history = convoMemory.get(clientId) || [];

    // compute topic once
    const topic = findTopicMatch(question);

    // Mid layer: topic-guided AI if local missing/weak
    if (needFallback) {
      if (topic && topic.text) {
        const system = 'אתה עוזר אישי של מוטי. ענה תמציתי, בעברית, ותישאר נאמן למידע שניתן.';
        const messages = [
          { role: 'system', content: system },
          ...history,
          { role: 'system', content: `מידע רלוונטי מהפרופיל:\n${topic.text}` },
          { role: 'user', content: question }
        ];
        const aiText = await askOpenAI({ messages });
        if (aiText && aiText.trim()) {
          finalText = aiText.trim();
          console.log(`[ASK] used=topic+ai  topic="${topic.topic}" q="${question}"`);
        }
      }
    }

    // Full AI fallback if still empty
    if (!finalText || !finalText.trim()) {
      const system = 'אתה עוזר אישי של מוטי. ענה תמציתי, בעברית, ותישאר נאמן למידע שניתן.';
      const messages = [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: question }
      ];
      const aiText = await askOpenAI({ messages });
      finalText = (aiText && aiText.trim()) || 'לא מצאתי תשובה כרגע.';
      console.log(`[ASK] used=openai  q="${question}"`);
    } else {
      console.log(`[ASK] used=local  q="${question}"`);
    }

    // Build follow-up suggestions
    const suggestions = await buildSuggestions({
      history,
      question,
      answer: finalText,
      topic
    });

    // assistant turn -> memory
    pushTurn(clientId, 'assistant', finalText);

    // Response shape used by frontend: answer + suggestions
    res.json({ answer: finalText, suggestions });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
