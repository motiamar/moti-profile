// index.js — local FAQ + topic matching engine
const fs = require('fs');
const path = require('path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'profile.json'), 'utf8')
) || {};

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[?!.,"'();:]/g, '')
    .replace(/[ך]/g, 'כ')
    .replace(/[ם]/g, 'מ')
    .replace(/[ן]/g, 'נ')
    .replace(/[ף]/g, 'פ')
    .replace(/[ץ]/g, 'צ')
    .trim();
}

function answerQuestion(question) {
  const q = (question || '').trim();
  if (!q) return { text: '', code: 'NO_LOCAL_ANSWER', confidence: 'low' };

  const qNorm = normalize(q);

  if (Array.isArray(data.faq)) {
    for (const item of data.faq) {
      if (!item) continue;
      const patterns = Array.isArray(item.patterns) ? item.patterns : [];
      for (const patt of patterns) {
        const p = normalize(patt);
        if (qNorm === p || qNorm.includes(p) || p.includes(qNorm)) {
          const text = typeof item.answer === 'string' && item.answer.trim()
            ? item.answer.trim()
            : '';
          if (text) return { text, confidence: 'high', source: 'json' };
        }
      }
    }
  }

  return { text: '', code: 'NO_LOCAL_ANSWER', confidence: 'low' };
}

function findTopicMatch(question) {
  const qNorm = normalize(question);
  if (Array.isArray(data.topics)) {
    for (const item of data.topics) {
      if (!item) continue;
      const keys = Array.isArray(item.keys) ? item.keys : [];
      for (const key of keys) {
        const kNorm = normalize(key);
        if (qNorm.includes(kNorm) || kNorm.includes(qNorm)) return item;
      }
    }
  }
  return null;
}

module.exports = { answerQuestion, findTopicMatch };

// Manual test runner (optional): node index.js
if (require.main === module) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('שלום! תשאל שאלה (או כתוב \'יציאה\'):');
  rl.on('line', line => {
    if (line.trim() === 'יציאה') { console.log('להתראות 👋'); rl.close(); return; }
    console.log(answerQuestion(line));
  });
}
