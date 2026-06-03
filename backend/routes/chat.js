// routes/chat.js — /ask and /reset endpoints
const express = require('express');
const router = express.Router();
const { answerQuestion, findTopicMatch } = require('../index');
const { askOpenAI } = require('../services/aiFallback');

const MOTI_IDENTITY = `אתה הנציג הדיגיטלי של מרדכי (מוטי) עמר באתר הפורטפוליו שלו.
כשהמשתמש אומר "אתה", "שלך", "מה אתה חושב" — הוא מתכוון למוטי. ענה בגוף ראשון מטעם מוטי.
אל תזדהה כ-AI, כ-ChatGPT, או כ-OpenAI.
אל תמציא עובדות אישיות שאינן מופיעות במידע שניתן לך.
אם אין לך מידע ספציפי על שאלה מסוימת, אמור: "אין לי את הפרט הזה בנתוני הפרופיל של מוטי." ולאחר מכן הצע מידע רלוונטי שכן קיים.
ענה בעברית, תמציתי ומקצועי.`;

const MOTI_BIO = `מידע בסיסי על מוטי:
- מרדכי (מוטי) עמר, בן 26, מנתניה
- סטודנט שנה אחרונה למדעי המחשב, מכון לב (JCT)
- שירת כמעט 5 שנים בחיל השריון, עד דרגת מפקד פלוגה מוקטנת
- שפות: C, C++, C#, Java, Python, JavaScript
- פרויקטים: מנוע Ray Tracing (Java), מערכת ניהול מתנדבים (C#/WPF), אתר פורטפוליו עם בוט (Node/Express)
- מחפש תפקיד פיתוח תוכנה עם אופק לניהול טכני
- זמין למשרת סטודנט, אזור נתניה, היברידי`;

// In-memory conversation store (keyed by clientId, max 10 turns)
const convoMemory = new Map();
const MAX_TURNS = 10;
function pushTurn(clientId, role, content) {
  if (!clientId) return;
  const arr = convoMemory.get(clientId) || [];
  arr.push({ role, content });
  while (arr.length > MAX_TURNS) arr.shift();
  convoMemory.set(clientId, arr);
}

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
    const raw = await askOpenAI({ messages });
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.suggestions)) return parsed.suggestions.slice(0, 4);
  } catch (_) {}

  if (topic?.topic) {
    return [`תן דוגמה מתוך "${topic.topic}"`, 'אפשר קוד קצר?'];
  }
  return [];
}

// POST /ask
router.post('/ask', async (req, res) => {
  try {
    const { question, clientId } = req.body || {};
    if (!question) return res.status(400).json({ error: 'No question provided' });

    pushTurn(clientId, 'user', question);

    let local = await Promise.resolve(answerQuestion(question));
    let localText = typeof local === 'string' ? local : local?.text;

    const needFallback =
      !localText ||
      !localText.trim() ||
      (typeof local === 'object' && (local.confidence === 'low' || local.code === 'NO_LOCAL_ANSWER')) ||
      /לא מצאתי תשובה|אין לי תשובה/i.test(localText);

    let finalText = localText;
    const history = convoMemory.get(clientId) || [];
    const topic = findTopicMatch(question);

    if (needFallback) {
      if (topic && topic.text) {
        const messages = [
          { role: 'system', content: MOTI_IDENTITY },
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

    if (!finalText || !finalText.trim()) {
      const messages = [
        { role: 'system', content: MOTI_IDENTITY },
        { role: 'system', content: MOTI_BIO },
        ...history,
        { role: 'user', content: question }
      ];
      const aiText = await askOpenAI({ messages });
      finalText = (aiText && aiText.trim()) || 'לא מצאתי תשובה כרגע.';
      console.log(`[ASK] used=openai  q="${question}"`);
    } else {
      console.log(`[ASK] used=local  q="${question}"`);
    }

    const suggestions = await buildSuggestions({ history, question, answer: finalText, topic });
    pushTurn(clientId, 'assistant', finalText);

    res.json({ answer: finalText, suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /reset
router.post('/reset', (req, res) => {
  const { clientId } = req.body || {};
  if (clientId) convoMemory.delete(clientId);
  res.json({ ok: true });
});

module.exports = router;
