// index.js
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// טוען את הידע מהקובץ JSON (נתיב מוחלט)
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "profile.json"), "utf8"));

/** ---- נירמול עברית בסיסי ---- */
function normalizeToken(tok) {
  if (!tok) return "";
  const finals = { "ך":"כ", "ם":"מ", "ן":"נ", "ף":"פ", "ץ":"צ" };
  tok = tok.replace(/[ךםןףץ]/g, ch => finals[ch]);
  if (tok.length > 3) tok = tok.replace(/(ים|ות)$/u, "");
  return tok;
}
function normalizeHeb(str) {
  if (!str) return "";
  let s = str
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[.,!?()"':;[\]{}<>־–—/\\]|[\d]/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  const stop = new Set(["של","על","עם","זה","אני","האם","יש","איך","ל","ב","ו","ה"]);
  const tokens = s.split(" ")
    .map(t => t.trim()).filter(Boolean)
    .map(normalizeToken)
    .filter(t => t && !stop.has(t));
  return tokens.join(" ");
}

/** ---- חישובי דמיון ---- */
function jaccardScore(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

/** ---- המנוע ---- */
function getAnswer(userQuestion) {
  const nq = normalizeHeb(userQuestion);
  const qTokens = new Set(nq.split(" ").filter(Boolean));
  let best = { score: 0, answer: null };

  for (const item of data.faq) {
    const itemQNorm = normalizeHeb(item.question);
    const kw = new Set(itemQNorm.split(" ").filter(Boolean));
    const score = jaccardScore(qTokens, kw);
    if (score > best.score) best = { score, answer: item.answer };
  }
  if (best.score >= 0.5) return best.answer;
  return "לא מצאתי תשובה מתאימה כרגע.";
}

function answerQuestion(question) {
  return getAnswer(question);
}
module.exports = { answerQuestion };

/** ---- CLI (רק בהרצה ישירה, לא ב-require בשרת) ---- */
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("שלום! תשאל שאלה (או כתוב 'יציאה'):");
  rl.on("line", (line) => {
    if (line.trim() === "יציאה") { console.log("להתראות 👋"); rl.close(); return; }
    console.log(getAnswer(line));
    console.log("\nשאלה נוספת?");
  });
}
