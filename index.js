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
  if (!question) return "כרגע אין לי תשובה";

  const qNorm = normalize(question);

  if (Array.isArray(data.faq)) {
    for (const item of data.faq) {
      if (Array.isArray(item.patterns)) {
        for (const patt of item.patterns) {
          if (qNorm === normalize(patt)) {
            return item.answer || "כרגע אין לי תשובה";
          }
        }
      }
    }
  }

  return "כרגע אין לי תשובה";
}

module.exports = { answerQuestion };

// בדיקה ידנית בטרמינל
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
    console.log(answerQuestion(line));
  });
}
