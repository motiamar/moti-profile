const express = require('express');
const path = require('path');
const { answerQuestion } = require('./index');
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
    
    // אם הפונקציה שלך מחזירה מחרוזת — נשאיר כמו שהוא.
    let localText = typeof local === 'string' ? local : local?.text;

    // 2) האם צריך פולבק?
    // תנאים שמדליקים OpenAI: אין טקסט, ריק, או קוד מיוחד שאתה מחזיר כשאין תשובה.
    const needFallback =
      !localText ||
      !localText.trim() ||
      (typeof local === 'object' && (local.confidence === 'low' || local.code === 'NO_LOCAL_ANSWER')) ||
      /לא מצאתי תשובה|אין לי תשובה/i.test(localText); // עובד גם אם אתה מחזיר הודעת ברירת־מחדל

    let finalText = localText;

    if (needFallback) {
      const aiText = await askOpenAI(question);
      finalText = aiText || "לא מצאתי תשובה כרגע.";
      console.log(`[ASK] used=openai  q="${question}"`);
    } else {
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
