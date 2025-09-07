// index.js
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---- קבועים ----
const EXACT_HIT_SCORE = 1.0;
const SOFT_HIT_THRESHOLD = 0.65;
const ACCEPT_THRESHOLD = 0.55;

// טוען את הידע מהקובץ JSON (נתיב מוחלט)
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "profile.json"), "utf8")) || {};

// ---- נירמול עברית ----
// הסרת קידומות (ו/ב/ל/כ/ה/מ) בתחילת מילה אחת או שתיים (למשל "וללימודים")
function stripHebPrefixes(tok) {
  // שתי קידומות לכל היותר: ו/ב/ל/כ/ה/מ
  return tok.replace(/^[ובלכהמ]{1,2}(?=[\u0590-\u05FF])/u, "");
}

function normalizeToken(tok) {
  if (!tok) return "";
  // אחידת סופיות
  const finals = { "ך":"כ", "ם":"מ", "ן":"נ", "ף":"פ", "ץ":"צ" };
  tok = tok.replace(/[ךםןףץ]/g, ch => finals[ch]);
  // הסרת קידומות בתחילת מילה
  tok = stripHebPrefixes(tok);
  // הסרת ריבוי נפוץ
  if (tok.length > 3) tok = tok.replace(/(ים|ות)$/u, "");
  return tok;
}

function normalizeHeb(str) {
  if (!str) return "";
  let s = str
    .replace(/[\u0591-\u05C7]/g, "") // ניקוד
    .replace(/[.,!?()"':;[\]{}<>־–—/\\]|[\d]/g, " ") // סימני פיסוק/ספרות -> רווח
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  const stop = new Set(["של","על","עם","זה","אני","האם","יש","איך","אם","את","אתה","אתם"]);
  const tokens = s.split(" ")
    .map(t => t.trim()).filter(Boolean)
    .map(normalizeToken)
    .filter(t => t && !stop.has(t));
  return tokens.join(" ");
}

// ---- חישובי דמיון ----
function jaccardScore(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

// ---- פרה-עיבוד ה-FAQ ----
const rawFaq = Array.isArray(data.faq) ? data.faq : [];
// מייצרים אינדקס עם דפוסים מנורמלים מראש וטוקנים שלהם
const faqIndex = rawFaq.map(item => {
  const patt = [];
  if (Array.isArray(item.patterns)) patt.push(...item.patterns);
  if (item.question) patt.push(item.question);
  if (item.id) patt.push(item.id.replace(/_/g, " "));

  // נירמול כל pattern פעם אחת
  const normPatterns = patt
    .map(p => normalizeHeb(p || ""))
    .filter(Boolean);

  const patternTokens = normPatterns.map(np =>
    new Set(np.split(/\s+/).filter(Boolean))
  );

  return {
    answer: item.answer || "",
    normPatterns,
    patternTokens
  };
});

/** ---- המנוע ---- */
function getAnswer(userQuestion) {
  const nq = normalizeHeb(userQuestion || "");
  if (!nq || faqIndex.length === 0) return "לא מצאתי תשובה מתאימה כרגע.";

  const qTokens = new Set(nq.split(/\s+/).filter(Boolean));
  let best = { score: 0, answer: null, hit: "none" }; // hit: 'exact' | 'soft' | 'none'

  for (const it of faqIndex) {
    let itemBestScore = 0;
    let itemHit = "none";

    for (let i = 0; i < it.normPatterns.length; i++) {
      const pn = it.normPatterns[i];
      if (!pn) continue;

      // אם השאילתה כוללת את הדפוס המנורמל → התאמה "כמעט מדויקת"
      if (nq.includes(pn)) {
        itemBestScore = Math.max(itemBestScore, EXACT_HIT_SCORE);
        itemHit = "exact";
        // אפשר continue כדי לבדוק אולי יש משהו עוד יותר "ארוך" – אבל 1.0 כבר מושלם
        continue;
      }

      // ציון Jaccard בין טוקנים
      const pTokens = it.patternTokens[i];
      const score = jaccardScore(qTokens, pTokens);
      if (score > itemBestScore) {
        itemBestScore = score;
        if (score >= SOFT_HIT_THRESHOLD) itemHit = "soft";
      }
    }

    if (
      itemBestScore > best.score ||
      (itemBestScore === best.score && best.hit !== "exact" && itemHit === "exact")
    ) {
      best = { score: itemBestScore, answer: it.answer, hit: itemHit };
    }
  }

  if (best.hit === "exact" || best.score >= ACCEPT_THRESHOLD) {
    return (best.answer || "לא מצאתי תשובה מתאימה כרגע.").trim();
  }
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
