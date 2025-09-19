const express = require('express');
const path = require('path');
const { answerQuestion, findTopicMatch } = require('./index');
require('dotenv').config();
const { askOpenAI } = require('./services/aiFallback');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === NEW: זיכרון שיחות קצר ===
const convoMemory = new Map(); // key: clientId, value: [{role, content}, ...]
const MAX_TURNS = 10;
function pushTurn(clientId, role, content) {
  if (!clientId) return;
  const arr = convoMemory.get(clientId) || [];
  arr.push({ role, content });
  // שומרים רק את 10 ההודעות האחרונות
  while (arr.length > MAX_TURNS) arr.shift();
  convoMemory.set(clientId, arr);
}

// Healthcheck
app.get('/health', (_, res) => res.send('OK'));

// (אופציונלי) לאיפוס היסטוריה מהפרונט
app.post('/reset', (req, res) => {
  const { clientId } = req.body || {};
  if (clientId) convoMemory.delete(clientId);
  res.json({ ok: true });
});

// API לקבלת תשובה
app.post('/ask', async (req, res) => {
  try {
    const { question, clientId } = req.body || {};
    if (!question) return res.status(400).json({ error: 'No question provided' });

    // נשמור את פנית המשתמש בהיסטוריה לפני הכל
    pushTurn(clientId, 'user', question);

    // 1) תשובה מקומית (JSON/מנוע פנימי)
    let local = await Promise.resolve(answerQuestion(question));
    let localText = typeof local === 'string' ? local : local?.text;

    // 2) האם צריך פולבק/שכבה אמצעית
    const needFallback =
      !localText ||
      !localText.trim() ||
      (typeof local === 'object' && (local.confidence === 'low' || local.code === 'NO_LOCAL_ANSWER')) ||
      /לא מצאתי תשובה|אין לי תשובה/i.test(localText);

    let finalText = localText;

    // === NEW: נכין היסטוריה עבור ה־AI ===
    const history = convoMemory.get(clientId) || [];
    // נסכם היסטוריה ארוכה (אם תרצה), כרגע נשלח כמו שהיא כדי לשמור מינימליות

    // 2.5) שכבה אמצעית עם topic רלוונטי + היסטוריה
    if (needFallback) {
      const topic = findTopicMatch(question);
      if (topic && topic.text) {
        const system = 'אתה עוזר אישי של מוטי. ענה תמציתי, בעברית, ותישאר נאמן למידע שניתן.';
        const messages = [
          { role: 'system', content: system },
          // היסטוריית השיחה עד כה
          ...history,
          // הנחיית הקשר
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

    // 3) פולבק מלא ל-AI אם עדיין אין מענה (עם היסטוריה)
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

    // === NEW: נשמור את תשובת הבוט בהיסטוריה
    pushTurn(clientId, 'assistant', finalText);

    res.json({ answer: finalText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
