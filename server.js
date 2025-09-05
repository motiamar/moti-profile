const express = require('express');
const path = require('path');
const { answerQuestion } = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck
app.get('/health', (_, res) => res.send('OK'));

// API לקבלת תשובה
app.post('/ask', (req, res) => {
  const { question } = req.body || {};
  if (!question) {
    return res.status(400).json({ error: 'No question provided' });
  }
  const answer = answerQuestion(question);
  res.json({ answer });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
