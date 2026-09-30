/*
 * Checks the web scoring engine against the professor's Excel results.
 * Run:  node tests/verify-scoring.js
 *
 * Answers are copied from the student sheets (column E, rows 48-97).
 * Expected deviations are the "Results Summary" rows for the same students.
 */
var config = require("../js/config.js");
var scoring = require("../js/scoring.js");

var failures = 0;
function check(label, ok, detail) {
  console.log((ok ? "  PASS  " : "  FAIL  ") + label + (ok || !detail ? "" : "  -> " + detail));
  if (!ok) failures++;
}

function toAnswers(list) {
  var a = {};
  config.questions.forEach(function (q, i) { a[q.id] = list[i]; });
  return a;
}

var students = [
  {
    name: "Avery B",
    answers: [5,2,4,5,3, 4,4,3,5,5, 4,5,5,4,5, 5,2,4,5,4, 2,4,4,5,4, 4,3,1,4,4, 5,5,3,5,1, 5,5,5,5,4, 5,5,4,4,5, 5,5,5,4,5],
    skillScores: [3.8, 4.2, 4.6, 4, 3.8, 3.2, 3.8, 4.8, 4.6, 4.8],
    gross: [8.2, 13.8, 10.8, 6.8, 12.4, 9.4, 8.4, 15.4, 6.6, 7.4, 8.0, 9.6, 8.6, 8.6, 14, 14.2, 14.2, 12.6, 12.2, 10.2, 12.6, 9, 7.4, 11.2, 11.2, 8.8, 11.2],
    top5: ["Credit Analyst", "Cash Management", "Risk Management", "Auditor", "Fraud"],
    bottom5: ["Customer Care", "Loan Operations", "Deposit Operations", "Loan Documentation", "Personal / Retail Banker"],
    topSkills: ["Professionalism", "Attention to Detail", "Critical Thinking / Problem Solving"] // from the professor's email
  },
  {
    name: "Ben M",
    answers: [4,2,4,5,3, 4,5,3,3,4, 2,4,5,2,3, 3,1,3,4,5, 2,4,4,4,3, 5,5,4,5,5, 4,4,4,5,2, 4,4,4,5,4, 5,4,3,4,5, 4,5,4,4,5],
    skillScores: [3.6, 3.8, 3.2, 3.2, 3.4, 4.8, 3.8, 4.2, 4.2, 4.4],
    gross: [9.2, 12.0, 9, 4.6, 9, 7.6, 6.6, 13.6, 6.4, 8.8, 9.4, 10.2, 8.4, 8.4, 11.8, 11.2, 11.2, 9.6, 9.6, 10.4, 9.6, 8.8, 8.4, 9.8, 11.4, 7.8, 8.2],
    top5: ["Cash Management", "Credit Analyst", "Wealth Management", "Investment Representative", "Human Resources"]
  },
  // Cayler R and Dane T: not in Results Summary, so check skill scores (B4:K4) and
  // the Top/Bottom 5 lists on their sheets (AD8:AD12, AD16:AD20).
  // (Their helper column AA holds another student's pasted values - ignore it.)
  {
    name: "Cayler R",
    answers: [3,5,4,3,2, 3,5,5,4,5, 3,3,4,3,4, 4,5,4,4,5, 3,3,3,3,2, 4,5,4,5,3, 5,3,4,5,4, 4,5,4,5,4, 5,4,4,3,4, 3,4,4,4,4],
    skillScores: [3.4, 4.4, 3.4, 4.4, 2.8, 4.2, 4.2, 4.4, 4, 3.8],
    top5: ["Credit Analyst", "Cash Management", "Risk Management", "Mortgage Underwriter", "Bank Examiner"],
    bottom5: ["Customer Care", "Loan Documentation", "Personal / Retail Banker", "Mortgage Lender", "Insurance Agent"]
  },
  {
    name: "Dane T",
    answers: [5,4,2,5,2, 4,4,1,5,3, 4,5,2,2,5, 3,1,3,2,5, 3,5,4,5,4, 5,4,2,4,2, 4,5,5,5,1, 1,4,5,5,4, 5,4,2,2,5, 4,4,5,4,3],
    skillScores: [3.6, 3.4, 3.6, 2.8, 4.2, 3.4, 4, 3.8, 3.6, 4],
    top5: ["Cash Management", "Wealth Management", "Investment Representative", "Human Resources", "Business Banker"],
    bottom5: ["Financial Analyst", "Data Analytics", "Loan Documentation", "Fraud", "Loan Review"]
  }
];

var cfgErrors = scoring.validateConfig(config);
console.log("\nSettings file");
check("config is internally consistent", cfgErrors.length === 0, cfgErrors.join("; "));
check("50 questions / 10 skills / 27 careers",
  config.questions.length === 50 && config.skills.length === 10 && config.careers.length === 27);

students.forEach(function (s) {
  console.log("\n" + s.name);
  var r = scoring.scoreSurvey(config, toAnswers(s.answers));
  var got = r.skillScores.map(function (x) { return x.score; });
  check("skill scores match Excel", JSON.stringify(got) === JSON.stringify(s.skillScores), JSON.stringify(got));

  if (s.gross) {
    var byName = {};
    r.matches.forEach(function (m) { byName[m.name] = m.gross; });
    var bad = config.careers.filter(function (c, i) { return Math.abs(byName[c.name] - s.gross[i]) > 1e-6; });
    check("gross deviation matches Excel for all 27 careers", bad.length === 0,
      bad.map(function (c) { return c.name; }).join(", "));
  }
  if (s.top5) check("top 5 matches Excel", JSON.stringify(r.topMatches.map(function (m) { return m.name; })) === JSON.stringify(s.top5),
    r.topMatches.map(function (m) { return m.name; }).join(", "));
  if (s.bottom5) check("bottom 5 matches Excel", JSON.stringify(r.bottomMatches.map(function (m) { return m.name; })) === JSON.stringify(s.bottom5),
    r.bottomMatches.map(function (m) { return m.name; }).join(", "));
  if (s.topSkills) check("top 3 skills match professor's email", JSON.stringify(r.topSkills.map(function (m) { return m.name; })) === JSON.stringify(s.topSkills),
    r.topSkills.map(function (m) { return m.name; }).join(", "));

});

console.log("\n" + (failures ? failures + " check(s) FAILED" : "All checks passed") + "\n");
process.exit(failures ? 1 : 0);
