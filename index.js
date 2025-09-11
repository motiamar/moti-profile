// index.js (גרסה פשוטה עם נירמול אותיות סופיות וסימני פיסוק)
const fs = require("fs");
const path = require("path");

// טוען את הידע מהקובץ JSON
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "profile.json"), "utf8")
) || {};

// פונקציית נירמול – מנקה פיסוק ומאחד אותיות סופיות
function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[?!.,"'();:]/g, "") // הסרת סימני פיסוק נפוצים
    .replace(/[ך]/g, "כ")
    .replace(/[ם]/g, "מ")
    .replace(/[ן]/g, "נ")
    .replace(/[ף]/g, "פ")
    .replace(/[ץ]/g, "צ")
    .trim();
}

// פונקציה עיקרית למענה
function answerQuestion(question) {
  const q = (question || "").trim();
  if (!q) {
    // אין שאלה → נפעיל פולבק
    return { text: "", code: "NO_LOCAL_ANSWER", confidence: "low" };
  }

  const qNorm = normalize(q);

  if (Array.isArray(data.faq)) {
    for (const item of data.faq) {
      if (!item) continue;
      const patterns = Array.isArray(item.patterns) ? item.patterns : [];
      for (const patt of patterns) {
        const p = normalize(patt);
        // התאמה טיפה סלחנית יותר: שוויון או "כולל"
        if (qNorm === p || qNorm.includes(p) || p.includes(qNorm)) {
          const text = (typeof item.answer === "string" && item.answer.trim())
            ? item.answer.trim()
            : "";
          if (text) {
            return { text, confidence: "high", source: "json" };
          }
        }
      }
    }
  }

  // לא נמצאה תשובה ב-JSON → פולבק
  return { text: "", code: "NO_LOCAL_ANSWER", confidence: "low" };
}

module.exports = { answerQuestion };

// בדיקה ידנית בטרמינל (אופציונלי)
if (require.main === module) {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("שלום! תשאל שאלה (או כתוב 'יציאה'):");
  rl.on("line", (line) => {
    if (line.trim() === "יציאה") {
      console.log("להתראות 👋");
      rl.close();
      return;
    }
    const ans = answerQuestion(line);
    console.log(ans.text || "[NO_LOCAL_ANSWER]");
  });
}
