const express = require('express');
const path = require('path');
const { answerQuestion, findTopicMatch } = require('./index');
require('dotenv').config();

// נייבא את הפולבק
const { askOpenAI } = require('./services/aiFallback');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck
app.get('/health', (_, res) => res.send('OK'));

// API לקבלת תשובה
app.post('/ask', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: 'No question provided' });
    }

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

    // 2.5) שכבה אמצעית: אם אין תשובה מקומית אבל יש topic עם מפתח תואם — שולחים ל-AI יחד עם הטקסט של ה-topic
    if (needFallback) {
      const topic = findTopicMatch(question);
      if (topic && topic.text) {
        const aiPrompt = `השאלה: "${question}"\n\nמידע רלוונטי מהפרופיל:\n${topic.text}`;
        const aiText = await askOpenAI(aiPrompt);
        if (aiText && aiText.trim()) {
          finalText = aiText.trim();
          console.log(`[ASK] used=topic+ai  topic="${topic.topic}" q="${question}"`);
        }
      }
    }

    // 3) פולבק מלא ל-AI אם עדיין אין מענה
    if (!finalText || !finalText.trim()) {
      const aiText = await askOpenAI(question);
      finalText = (aiText && aiText.trim()) || "לא מצאתי תשובה כרגע.";
      console.log(`[ASK] used=openai  q="${question}"`);
    } else if (!needFallback) {
      console.log(`[ASK] used=local  q="${question}"`);
    }

    // שמרנו את הפורמט הקיים של ה-API:
    res.json({ answer: finalText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
