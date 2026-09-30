/**
 * Banking Career Assessment - Google Apps Script backend
 * ----------------------------------------------------------------------------
 * Does two things for the survey website:
 *   1. "save"  - writes each student's name, answers, skill scores and career
 *                deviations as one row in this Google Sheet.
 *   2. "email" - emails the student a copy of their results. The address is
 *                used to send and is NOT written anywhere.
 *
 * Setup (details in README.md):
 *   - Create a Google Sheet (ideally from the professor's / Center's account).
 *   - Extensions > Apps Script, paste this file, save.
 *   - Deploy > New deployment > Web app
 *       Execute as: Me      Who has access: Anyone
 *   - Copy the Web app URL into js/config.js -> backendUrl.
 *
 * Emails are sent from whichever Google account deploys this script.
 */

var SETTINGS = {
  // ID of the responses Google Sheet (the long code in its URL). Leave blank
  // if this script was created from the Sheet itself (Extensions > Apps Script).
  spreadsheetId: "",
  sheetPrefix: "Responses v",                 // one tab per survey version
  allowedEmailDomains: ["ndsu.edu"],          // keep in sync with config.js; [] = any
  maxEmailsPerSubmission: 3,
  senderName: "NDSU Center for Banking and Finance",
  replyTo: "",                                // e.g. the professor's address; blank = sender
  emailSubject: "Your Banking Career Assessment results"
};

function doGet() {
  return json_({ ok: true, service: "banking-career-assessment", time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === "save") return json_(saveResponse_(body));
    if (body.action === "email") return json_(emailResults_(body));
    return json_({ ok: false, error: "Unknown action" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// --------------------------------------------------------------------------- save
function saveResponse_(d) {
  if (!d.submissionId || !d.profile || !d.answers) throw new Error("Incomplete submission");
  var p = d.profile;
  var record = {
    "Timestamp": new Date(),
    "Submission ID": d.submissionId,
    "Model Version": d.configVersion,
    "Name": clip_(p.name),
    "Status": clip_(p.status),
    "Major(s)": clip_((p.majors || []).join(", ")),
    "Minors / Certificates": clip_(p.minors)
  };
  (d.questionOrder || Object.keys(d.answers)).forEach(function (id) { record[id] = Number(d.answers[id]); });
  Object.keys(d.skillScores || {}).forEach(function (k) { record["Skill: " + k] = d.skillScores[k]; });
  Object.keys(d.careerDeviations || {}).forEach(function (k) { record["Dev: " + k] = d.careerDeviations[k]; });
  record["Top 3 Skills"] = (d.topSkills || []).join(", ");
  record["Top 5 Matches"] = (d.topMatches || []).map(function (m) { return m.name; }).join(", ");
  record["Bottom 5 Matches"] = (d.bottomMatches || []).map(function (m) { return m.name; }).join(", ");
  record["Emails Sent"] = 0;
  record["Results JSON"] = JSON.stringify({ name: p.name, topSkills: d.topSkills, ranking: d.ranking,
    topMatches: d.topMatches, bottomMatches: d.bottomMatches, skillScores: d.skillScores });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_(String(d.configVersion || "unknown"));
    var headers = ensureHeaders_(sheet, Object.keys(record));
    var row = headers.map(function (h) { return record.hasOwnProperty(h) ? record[h] : ""; });
    var existing = findRow_(sheet, headers, d.submissionId);
    if (existing) sheet.getRange(existing, 1, 1, row.length).setValues([row]); // retry-safe
    else sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function getSheet_(version) {
  var ss = getSpreadsheet_();
  var name = SETTINGS.sheetPrefix + version;
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** Uses the sheet's existing header row; adds any new columns at the end. */
function ensureHeaders_(sheet, keys) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var added = keys.filter(function (k) { return headers.indexOf(k) === -1; });
  if (added.length) {
    headers = headers.concat(added);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return headers;
}

function findRow_(sheet, headers, submissionId) {
  var col = headers.indexOf("Submission ID") + 1;
  if (!col || sheet.getLastRow() < 2) return 0;
  var hit = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).createTextFinder(submissionId).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

// --------------------------------------------------------------------------- email
function emailResults_(d) {
  var email = String(d.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address");
  var domains = SETTINGS.allowedEmailDomains;
  if (domains.length && !domains.some(function (dm) { return email.slice(-(dm.length + 1)) === "@" + dm; }))
    throw new Error("Please use your @" + domains.join(" or @") + " address");
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Daily email limit reached. Please try again tomorrow");

  // Build the email only from results already saved on the sheet, so the
  // endpoint can't be used to send arbitrary content.
  var ss = getSpreadsheet_();
  var found = null;
  ss.getSheets().forEach(function (sh) {
    if (found || sh.getName().indexOf(SETTINGS.sheetPrefix) !== 0 || sh.getLastColumn() === 0) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var r = findRow_(sh, headers, String(d.submissionId || ""));
    if (r) found = { sheet: sh, row: r, headers: headers };
  });
  if (!found) throw new Error("Results not found. Please wait a moment and try again");

  var sentCol = found.headers.indexOf("Emails Sent") + 1;
  var sentCell = found.sheet.getRange(found.row, sentCol);
  var sent = Number(sentCell.getValue()) || 0;
  if (sent >= SETTINGS.maxEmailsPerSubmission) throw new Error("A copy has already been sent " + sent + " times");

  var res = JSON.parse(found.sheet.getRange(found.row, found.headers.indexOf("Results JSON") + 1).getValue());
  var opts = { name: SETTINGS.senderName, htmlBody: emailHtml_(res) };
  if (SETTINGS.replyTo) opts.replyTo = SETTINGS.replyTo;
  MailApp.sendEmail(email, SETTINGS.emailSubject, emailText_(res), opts);
  sentCell.setValue(sent + 1); // count only - the address is not stored
  return { ok: true };
}

function emailText_(r) {
  var first = String(r.name || "").split(" ")[0];
  var lines = ["Hi " + first + ",", "", "Thanks for completing the Banking Career Assessment. Here are your results.", "",
    "Top 3 skills: " + r.topSkills.join(", "), "", "Top 5 career matches (deviation):"];
  r.topMatches.forEach(function (m) { lines.push("  " + m.name + "  " + m.gross.toFixed(2)); });
  lines.push("", "Bottom 5 career matches (deviation):");
  r.bottomMatches.forEach(function (m) { lines.push("  " + m.name + "  " + m.gross.toFixed(2)); });
  lines.push("", "All career paths, ranked (lower deviation = closer match):");
  r.ranking.forEach(function (m) { lines.push("  " + m.rank + ". " + m.name + "  " + m.gross.toFixed(2)); });
  lines.push("", "Take this as food for thought. The model isn't perfect, but it's a place to start in mapping your skills against different banking careers.",
    "", SETTINGS.senderName);
  return lines.join("\n");
}

function emailHtml_(r) {
  var first = esc_(String(r.name || "").split(" ")[0]);
  function rows(list, withRank) {
    return list.map(function (m) {
      return "<tr>" + (withRank ? '<td style="padding:3px 10px 3px 0;color:#667">' + m.rank + "</td>" : "") +
        '<td style="padding:3px 16px 3px 0">' + esc_(m.name) + '</td><td style="padding:3px 0;text-align:right;font-family:monospace">' + m.gross.toFixed(2) + "</td></tr>";
    }).join("");
  }
  var th = '<tr><th align="left" style="padding-right:16px">Career Path</th><th align="right">Deviation</th></tr>';
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1b2621;max-width:600px">' +
    "<p>Hi " + first + ",</p><p>Thanks for completing the Banking Career Assessment. Below are your top 3 skill areas out of the 10 measured, and how closely you match " +
    "each of the career paths in the survey. A lower deviation means a closer match to the \"ideal\" profile for that career.</p>" +
    "<h3 style=\"color:#0b5a43;margin-bottom:4px\">Top 3 Skills</h3><p style=\"margin-top:0\">" + r.topSkills.map(esc_).join("<br>") + "</p>" +
    '<h3 style="color:#0b5a43;margin-bottom:4px">Top 5 Career Matches</h3><table cellspacing="0">' + th + rows(r.topMatches) + "</table>" +
    '<h3 style="color:#a2432f;margin-bottom:4px">Bottom 5 Career Matches</h3><table cellspacing="0">' + th + rows(r.bottomMatches) + "</table>" +
    '<h3 style="margin-bottom:4px">All Career Paths, Ranked</h3><table cellspacing="0">' + rows(r.ranking, true) + "</table>" +
    "<p>Take this as food for thought. The model isn't perfect, but it's a place to start in mapping a set of skills and preferences against different jobs " +
    "that normally require more (or less) of certain things.</p><p>" + esc_(SETTINGS.senderName) + "</p></div>";
}

// --------------------------------------------------------------------------- helpers
function getSpreadsheet_() {
  return SETTINGS.spreadsheetId ? SpreadsheetApp.openById(SETTINGS.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
// Trim free text and stop it being read as a spreadsheet formula (=, +, -, @).
function clip_(v) {
  var s = String(v == null ? "" : v).slice(0, 500);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
}

/** Run once from the editor to authorize Sheets + Mail and create a test row. */
function testSetup() {
  var ss = getSpreadsheet_();
  if (/^Untitled/.test(ss.getName())) ss.rename("Banking Career Assessment - Responses");
  var res = saveResponse_({ submissionId: "test-" + Date.now(), configVersion: "test", profile: { name: "Test Student", majors: ["Finance"] },
    answers: { "S-1": 3 }, questionOrder: ["S-1"], skillScores: {}, careerDeviations: {}, topSkills: [], topMatches: [], bottomMatches: [], ranking: [] });
  console.log(res, "Remaining email quota today:", MailApp.getRemainingDailyQuota());
}
