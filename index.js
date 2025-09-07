// index.js
const fs = require("fs");
const path = require("path");
const readline = require("readline");

/* ===================== קבועים ===================== */
const EXACT_HIT_SCORE      = 1.0;  // ניקוד להתאמה כמעט-מדויקת (includes אחרי נירמול)
const SOFT_HIT_THRESHOLD   = 0.75; // מתי נסמן hit="soft" (דמיון טוב)
const ACCEPT_SCORE         = 0.85; // סף ניקוד משולב מינימלי
const ACCEPT_LEN_SIM       = 0.80; // סף דמיון אורך מינימלי
const ACCEPT_F1            = 0.67; // סף F1 מינימלי (דיוק/כיסוי)
const MIN_INTER_TOKENS     = 3;    // מינימום חפיפת טוקנים (למעט exact)
const MIN_Q_TOKENS         = 3;    // מינימום טוקנים בשאלה כדי לשקול התאמה
const MIN_PATTERN_TOKENS   = 3;    // מינימום טוקנים בתבנית כדי לשקול התאמה

/* ===================== טעינת נתונים ===================== */
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "profile.json"), "utf8")
) || {};

/* ===================== נירמול עברית ===================== */
// הסרת קידומות ו/ב/ל/כ/ה/מ בתחילת מילה (עד 2 קידומות)
function stripHebPrefixes(tok) {
  return tok.replace(/^[ובלכהמ]{1,2}(?=[\u0590-\u05FF])/u, "");
}
function normalizeToken(tok) {
  if (!tok) return "";
  // אחידות אותיות סופיות
  tok = tok.replace(/[ך]/g, "כ").replace(/[ם]/g, "מ")
           .replace(/[ן]/g, "נ").replace(/[ף]/g, "פ").replace(/[ץ]/g, "צ");
  tok = stripHebPrefixes(tok);
  // סיומות רבים נפוצות
  if (tok.length > 3) tok = tok.replace(/(ים|ות)$/u, "");
  return tok;
}
function normalizeHeb(str) {
  if (!str) return "";
  let s = str
    .replace(/[\u0591-\u05C7]/g, "") // ניקוד
    .replace(/[.,!?()"':;[\]{}<>־–—/\\]|[\d]/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  // stopwords בסיסי (אפשר להרחיב)
  const stop = new Set(["של","על","עם","זה","אני","האם","יש","איך","אם","את","אתה","אתם","מה","כן","לא"]);

  const tokens = s.split(" ")
    .map(t => t.trim()).filter(Boolean)
    .map(normalizeToken)
    .filter(t => t && !stop.has(t));

  return tokens.join(" ");
}

/* ===================== דמיון ===================== */
function jaccard(setA, setB) {
  if (!setA.size || !setB.size) return {score:0, inter:0};
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return { score: union ? inter/union : 0, inter };
}
function lengthSimilarity(a, b) {
  const la = a.length, lb = b.length;
  if (!la && !lb) return 1;
  const mx = Math.max(la, lb);
  return 1 - Math.abs(la - lb) / mx;
}
function prf(qSet, pSet) {
  let inter = 0;
  for (const t of qSet) if (pSet.has(t)) inter++;
  const precision = pSet.size ? inter / pSet.size : 0;
  const recall    = qSet.size ? inter / qSet.size : 0;
  const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
  return {inter, precision, recall, f1};
}

/* ===================== פרה-עיבוד ה-FAQ ===================== */
const rawFaq = Array.isArray(data.faq) ? data.faq : [];
const faqIndex = rawFaq.map(item => {
  const patt = [];
  if (Array.isArray(item.patterns)) patt.push(...item.patterns);
  if (item.question) patt.push(item.question);
  if (item.id) patt.push(item.id.replace(/_/g, " "));

  const normPatterns = patt.map(p => normalizeHeb(p || "")).filter(Boolean);
  const patternTokens = normPatterns.map(np => new Set(np.split(/\s+/).filter(Boolean)));

  return {
    answer: (item.answer || "").trim(),
    normPatterns,
    patternTokens
  };
});

/* ===================== המנוע ===================== */
function getAnswerWithMeta(userQuestion) {
  const nq = normalizeHeb(userQuestion || "");
  const qArr = nq ? nq.split(/\s+/).filter(Boolean) : [];
  const qTokens = new Set(qArr);

  if (!nq || faqIndex.length === 0 || qArr.length < MIN_Q_TOKENS) {
    return {
      matched: false,
      confidence: 0,
      source: "fallback",
      reason: !nq || qArr.length < MIN_Q_TOKENS ? "question-too-short-or-empty" : "no-faq",
      answer: null
    };
  }

  const candidates = []; // {score, hit, lenSim, answer, f1, precision, recall, inter, pattern}

  for (const it of faqIndex) {
    let itemBest = { score: 0, hit: "none", lenSim: 0, f1: 0, precision: 0, recall: 0, inter: 0, pattern: "" };

    for (let i = 0; i < it.normPatterns.length; i++) {
      const pn = it.normPatterns[i];
      if (!pn) continue;

      const pTokens = it.patternTokens[i];
      if (!pTokens || pTokens.size < MIN_PATTERN_TOKENS) continue;

      // exact-ish: הטקסט המנורמל של התבנית קיים בשאלה המנורמלת
      if (nq.includes(pn)) {
        const lenSim = lengthSimilarity(nq, pn);
        if (
          EXACT_HIT_SCORE > itemBest.score ||
          (EXACT_HIT_SCORE === itemBest.score && lenSim > itemBest.lenSim)
        ) {
          // ב-exact אנחנו לא מחשבים F1 (אבל אפשר)
          itemBest = { score: EXACT_HIT_SCORE, hit: "exact", lenSim, f1: 1, precision: 1, recall: 1, inter: pTokens.size, pattern: pn, answer: it.answer };
        }
        continue;
      }

      // דמיון טוקנים + PRF
      const jac = jaccard(qTokens, pTokens);
      if (jac.inter < MIN_INTER_TOKENS) continue;

      const { inter, precision, recall, f1 } = prf(qTokens, pTokens);
      const lenSim = lengthSimilarity(nq, pn);
      const combined = jac.score * 0.9 + lenSim * 0.1;

      if (
        combined > itemBest.score ||
        (combined === itemBest.score && (f1 > itemBest.f1 || lenSim > itemBest.lenSim))
      ) {
        itemBest = {
          score: combined,
          hit: (jac.score >= SOFT_HIT_THRESHOLD ? "soft" : "none"),
          lenSim,
          f1,
          precision,
          recall,
          inter,
          pattern: pn,
          answer: it.answer
        };
      }
    }

    if (itemBest.score > 0) {
      candidates.push(itemBest);
    }
  }

  // בחירת מועמד סופי
  candidates.sort((a, b) => {
    if (a.hit === "exact" && b.hit !== "exact") return -1;
    if (b.hit === "exact" && a.hit !== "exact") return 1;
    if (b.score !== a.score) return b.score - a.score;
    if (b.f1 !== a.f1) return b.f1 - a.f1;
    return b.lenSim - a.lenSim;
  });

  const best = candidates[0];

  if (!best) {
    return {
      matched: false,
      confidence: 0,
      source: "fallback",
      reason: "no-candidate",
      answer: null
    };
  }

  // כללי קבלה מחמירים:
  const acceptExact = (best.hit === "exact" && best.lenSim >= ACCEPT_LEN_SIM);
  const acceptF1    = (best.f1 >= ACCEPT_F1 && best.score >= ACCEPT_SCORE);

  if (acceptExact || acceptF1) {
    const conf = acceptExact ? Math.max(best.lenSim, 0.9) : Math.max(best.f1, best.score);
    return {
      matched: true,
      confidence: Number(conf.toFixed(3)),
      source: "kb",
      reason: acceptExact ? "exactish" : "semantic-match",
      meta: {
        score: Number(best.score.toFixed(3)),
        lenSim: Number(best.lenSim.toFixed(3)),
        f1: Number(best.f1.toFixed(3)),
        precision: Number(best.precision.toFixed(3)),
        recall: Number(best.recall.toFixed(3)),
        inter: best.inter,
        pattern: best.pattern
      },
      answer: best.answer || null
    };
  }

  // לא עבר ספים -> לוותר כדי שה-AI ייכנס
  return {
    matched: false,
    confidence: Number(Math.max(best.f1, best.score).toFixed(3)),
    source: "fallback",
    reason: "low-confidence",
    meta: {
      score: Number(best.score.toFixed(3)),
      lenSim: Number(best.lenSim.toFixed(3)),
      f1: Number(best.f1.toFixed(3)),
      precision: Number(best.precision.toFixed(3)),
      recall: Number(best.recall.toFixed(3)),
      inter: best.inter,
      pattern: best.pattern
    },
    answer: null
  };
}

// שמרתי תאימות אחורה למי שמצפה למחרוזת בלבד:
function answerQuestion(question) {
  const r = getAnswerWithMeta(question);
  if (r.matched && r.answer) return r.answer;
  // ברירת מחדל כשהמנוע "מוותר"
  return "לא מצאתי תשובה מתאימה כרגע.";
}
module.exports = { answerQuestion, getAnswerWithMeta };

/* ===================== CLI לבדיקה ידנית ===================== */
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("שלום! תשאל שאלה (או כתוב 'יציאה'):");
  rl.on("line", (line) => {
    if (line.trim() === "יציאה") { console.log("להתראות 👋"); rl.close(); return; }
    const res = getAnswerWithMeta(line);
    console.log(res);
    console.log("\nשאלה נוספת?");
  });
}
