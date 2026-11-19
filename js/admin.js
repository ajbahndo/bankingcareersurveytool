/*
 * Admin settings page (admin.html).
 * Lets an admin change the scoring criteria without touching code:
 *   - each career's ideal 1-5 rating for every skill (add / remove / rename careers too)
 *   - how deviation is calculated, how many top/bottom matches and top skills show, the skill tie-break rule
 * Settings are saved to the Google Apps Script backend, protected by the admin password kept there.
 * The survey reads them when it loads (see applyOverrides in scoring.js).
 */
(function () {
  "use strict";
  var CFG = window.SURVEY_CONFIG, S = window.SurveyScoring;
  var root = document.getElementById("admin");
  var TOKEN_KEY = "bca-admin-token";

  // The defaults from config.js, untouched, so "restore original" and change-highlighting have something to compare to.
  var DEFAULTS = {
    scoring: JSON.parse(JSON.stringify({ deviationMethod: CFG.scoring.deviationMethod, topMatches: CFG.scoring.topMatches,
      bottomMatches: CFG.scoring.bottomMatches, topSkills: CFG.scoring.topSkills, skillTieBreak: CFG.scoring.skillTieBreak })),
    careers: CFG.careers.map(function (c) { return { name: c.name, group: c.group, category: c.category || "", description: c.description || "", profile: c.profile.slice() }; })
  };

  var st = {
    screen: "login", busy: false, error: "", notice: "", token: null,
    revision: 0, updatedAt: null,
    saved: null,            // what the survey is using right now: {scoring, careers}
    draft: null,            // what's on screen
    tryScores: CFG.skills.map(function () { return 3.5; }),
    resetConfirm: false
  };
  try { st.token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { /* ignore */ }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fmt(n) { return n == null ? "-" : Number(n).toFixed(2); }

  // ------------------------------------------------------------ backend
  function post(payload) {
    return fetch(CFG.backendUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || "Unknown error"); return d; });
  }

  function fromOverrides(o) {
    var base = clone(DEFAULTS);
    if (o && o.scoring) Object.keys(o.scoring).forEach(function (k) { base.scoring[k] = o.scoring[k]; });
    if (o && o.careers) base.careers = o.careers.map(function (c) { return { name: c.name, group: c.group, category: c.category || "", description: c.description || "", profile: c.profile.slice() }; });
    return base;
  }
  function adopt(o) {
    var errs = o && (o.scoring || o.careers) ? S.validateOverrides(CFG, o) : [];
    if (errs.length) { st.error = "The saved settings don't fit the current survey (" + errs[0] + "). Showing the originals."; o = null; }
    st.revision = o ? Number(o.revision) || 0 : 0;
    st.updatedAt = o ? o.updatedAt : null;
    st.saved = fromOverrides(o);
    st.draft = clone(st.saved);
    // Remember which saved career each row came from, so edits (even renames) highlight against the right original.
    st.draft.careers.forEach(function (c, i) { c._origName = st.saved.careers[i].name; });
    st.resetConfirm = false;
  }

  function login(password) {
    st.busy = true; st.error = ""; render();
    post({ action: "adminLogin", password: password }).then(function (d) {
      st.token = d.token; try { sessionStorage.setItem(TOKEN_KEY, d.token); } catch (e) { /* ignore */ }
      adopt(d.overrides); st.screen = "edit"; st.busy = false; render();
    }).catch(function (e) { st.busy = false; st.error = e.message; render(); });
  }
  function resume() {
    st.busy = true; render();
    post({ action: "adminLoad", token: st.token }).then(function (d) { adopt(d.overrides); st.screen = "edit"; st.busy = false; render(); })
      .catch(function () { st.token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } st.busy = false; st.screen = "login"; render(); });
  }
  function logout() {
    var t = st.token; st.token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    if (t) post({ action: "adminLogout", token: t }).catch(function () {});
    st.screen = "login"; st.draft = null; st.error = ""; st.notice = ""; render();
  }

  // UI-only row flags (_open, _new, _origName) never leave the page.
  function strip(x) { var c = clone(x); c.careers.forEach(function (k) { delete k._open; delete k._new; delete k._origName; }); return c; }
  function payload() {
    var d = strip(st.draft);
    d.careers.forEach(function (c) { c.name = c.name.trim(); c.category = c.category.trim() || null; });
    return d;
  }
  function problems() {
    return S.validateOverrides(CFG, payload());
  }
  function dirty() { return JSON.stringify(strip(st.draft)) !== JSON.stringify(strip(st.saved)); }

  function save() {
    var errs = problems();
    if (errs.length) { st.error = "Fix these first:"; st.problemList = errs; st.notice = ""; render(); return; }
    st.problemList = null; st.busy = true; st.error = ""; st.notice = ""; render();
    post({ action: "adminSave", token: st.token, expectedRevision: st.revision, overrides: payload() }).then(function (d) {
      adopt(d.overrides); st.busy = false;
      st.notice = "Saved. New students get these settings right away (settings version " + CFG.version + "-r" + st.revision + "). Past responses are not changed."; render();
    }).catch(function (e) { st.busy = false; st.error = e.message; render(); });
  }
  function resetToOriginal() {
    st.busy = true; st.error = ""; render();
    post({ action: "adminReset", token: st.token, expectedRevision: st.revision }).then(function (d) {
      adopt(d.overrides); st.busy = false; st.notice = "Restored the original settings from config.js."; render();
    }).catch(function (e) { st.busy = false; st.error = e.message; render(); });
  }

  // ------------------------------------------------------------ render
  function render() {
    var scrollY = window.scrollY, focus = document.activeElement && document.activeElement.id;
    root.innerHTML = '<header class="masthead"><span class="org">' + esc(CFG.organization) + '</span><span class="mode-tag">Admin settings</span></header>' +
      (st.screen === "login" ? loginView() : editView());
    if (st.screen === "edit") { window.scrollTo(0, scrollY); }
    var f = focus && document.getElementById(focus); if (f && f.focus && f.tagName !== "BUTTON") { f.focus(); try { var v = f.value; if (f.setSelectionRange && f.type === "text") f.setSelectionRange(v.length, v.length); } catch (e) { /* number inputs */ } }
  }

  function loginView() {
    if (!CFG.backendUrl) return '<section class="stack login"><h1>Scoring settings</h1><div class="msg bad">No backend is connected in config.js, so settings can\'t be saved. Finish the Google Apps Script setup first (see README).</div></section>';
    return '<section class="stack login card"><div class="stack"><p class="eyebrow">Admin only</p><h1>Scoring settings</h1>' +
      '<p class="muted small">Sign in to change how survey results are scored.</p></div>' +
      (st.error ? '<div class="msg bad">' + esc(st.error) + '</div>' : "") +
      '<form id="login-form" class="stack" novalidate><div class="field"><label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" autofocus></div>' +
      '<div class="actions"><button class="btn" type="submit"' + (st.busy ? " disabled" : "") + '>' + (st.busy ? "Signing in..." : "Sign in") + '</button></div></form></section>';
  }

  function editView() {
    var d = st.draft, sv = st.saved, sc = d.scoring, isDirty = dirty();
    function opt(val, cur, label) { return '<option value="' + val + '"' + (val === cur ? " selected" : "") + '>' + label + '</option>'; }
    function chg(k) { return sc[k] !== sv.scoring[k] ? " changed" : ""; }

    var head = '<div class="admin-bar"><div><strong>Scoring settings</strong> <span class="state' + (isDirty ? " dirty" : "") + '">' +
      (isDirty ? "Unsaved changes" : st.revision ? "Saved settings in use (revision " + st.revision + (st.updatedAt ? ", " + esc(new Date(st.updatedAt).toLocaleString()) : "") + ")" : "Using the original settings from config.js") + '</span></div>' +
      '<div class="toolbar"><button class="btn secondary" data-act="discard"' + (isDirty && !st.busy ? "" : " disabled") + '>Discard changes</button>' +
      '<button class="btn" data-act="save"' + (isDirty && !st.busy ? "" : " disabled") + '>' + (st.busy ? "Working..." : "Save changes") + '</button>' +
      '<button class="btn link" data-act="logout">Sign out</button></div></div>';

    var msgs = (st.notice ? '<div class="msg ok">' + esc(st.notice) + '</div>' : "") +
      (st.error ? '<div class="msg bad">' + esc(st.error) + (st.problemList ? '<ul>' + st.problemList.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + '</ul>' : "") + '</div>' : "");

    var general = '<section class="stack card"><h2>How results are calculated</h2><div class="settings-grid">' +
      '<div class="field"><label for="s-deviationMethod">Deviation method</label><select id="s-deviationMethod" data-scoring="deviationMethod" class="' + chg("deviationMethod") + '">' +
        opt("absolute", sc.deviationMethod, "Absolute (matches the Excel model)") + opt("shortfall", sc.deviationMethod, "Shortfall only (experimental)") + '</select>' +
        '<p class="hint">Absolute counts scoring above or below a career\'s ideal as a mismatch. Shortfall only counts skills where the student falls short.</p></div>' +
      '<div class="field"><label for="s-topMatches">Top matches shown</label><input type="number" min="1" max="' + d.careers.length + '" id="s-topMatches" data-scoring="topMatches" data-int="1" value="' + esc(sc.topMatches) + '" class="' + chg("topMatches") + '"></div>' +
      '<div class="field"><label for="s-bottomMatches">Bottom matches shown</label><input type="number" min="1" max="' + d.careers.length + '" id="s-bottomMatches" data-scoring="bottomMatches" data-int="1" value="' + esc(sc.bottomMatches) + '" class="' + chg("bottomMatches") + '"></div>' +
      '<div class="field"><label for="s-topSkills">Top skills shown</label><input type="number" min="1" max="' + CFG.skills.length + '" id="s-topSkills" data-scoring="topSkills" data-int="1" value="' + esc(sc.topSkills) + '" class="' + chg("topSkills") + '"></div>' +
      '<div class="field"><label for="s-skillTieBreak">Tie-break for top skills</label><select id="s-skillTieBreak" data-scoring="skillTieBreak" class="' + chg("skillTieBreak") + '">' +
        opt("surveyOrder", sc.skillTieBreak, "Survey order") + opt("topCareerRelevance", sc.skillTieBreak, "Skill the top careers rely on most") + '</select></div>' +
      '</div></section>';

    // Careers table
    var skillHead = CFG.skills.map(function (s) { return '<th class="num" title="' + esc(s.name) + '">' + esc(s.short) + '</th>'; }).join("");
    var rows = d.careers.map(function (c, i) {
      var orig = sv.careers.filter(function (x) { return x.name === c._origName; })[0] || sv.careers[i];
      var isNew = c._new;
      var cells = c.profile.map(function (v, k) {
        var ch = !isNew && orig && Number(orig.profile[k]) !== Number(v);
        var bad = !(typeof v === "number" && v >= 1 && v <= 5);
        return '<td class="num"><input type="number" step="0.5" min="1" max="5" data-row="' + i + '" data-skill="' + k + '" aria-label="' + esc(c.name + " " + CFG.skills[k].name) + '" value="' + esc(v) + '" class="' + (bad ? "invalid" : ch ? "changed" : "") + '"></td>';
      }).join("");
      return '<tr class="' + (isNew ? "new" : "") + '"><td><input type="text" id="n-' + i + '" data-row="' + i + '" data-field="name" value="' + esc(c.name) + '" aria-label="Career name"></td>' +
        '<td><select data-row="' + i + '" data-field="group" aria-label="Group">' + CFG.careerGroups.map(function (g) { return opt(g, c.group, g); }).join("") + '</select></td>' + cells +
        '<td class="row-actions"><button class="btn link" data-act="toggle" data-row="' + i + '">' + (c._open ? "Hide" : "Details") + '</button> <button class="btn link" data-act="remove" data-row="' + i + '">Remove</button></td></tr>' +
        (c._open ? '<tr class="details-row"><td colspan="' + (CFG.skills.length + 3) + '"><div class="more"><input type="text" data-row="' + i + '" data-field="category" placeholder="Category (optional)" value="' + esc(c.category) + '" aria-label="Category">' +
          '<input type="text" data-row="' + i + '" data-field="description" placeholder="One-line description shown on the results page (optional)" value="' + esc(c.description) + '" aria-label="Description"></div></td></tr>' : "");
    }).join("");

    var careers = '<section class="stack card"><div><h2>Career profiles</h2><p class="muted small">Each number is the <strong>ideal rating (1 to 5)</strong> for that skill. A student\'s deviation is how far their skill averages are from these numbers, so changing a profile changes who matches the career. Half points (3.5) are allowed. Changed cells are highlighted.</p></div>' +
      '<div class="table-scroll"><table class="careers"><thead><tr><th>Career</th><th>Group</th>' + skillHead + '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="toolbar"><button class="btn secondary" data-act="add">Add a career</button><button class="btn secondary" data-act="export">Download settings (backup)</button>' +
      '<label class="btn secondary" style="cursor:pointer">Load from backup<input type="file" accept="application/json" id="import-file" style="display:none"></label></div></section>';

    // Try-it panel
    var test = tryPanel();

    var reset = '<section class="stack card"><h2>Start over</h2><p class="muted small">Go back to the original settings from the Excel workbook (the ones in <code>config.js</code>). Takes effect for new students right away.</p>' +
      (st.resetConfirm ? '<div class="toolbar"><span>Restore the original settings?</span><button class="btn" data-act="reset-yes">Yes, restore</button><button class="btn secondary" data-act="reset-no">Cancel</button></div>' :
      '<div class="toolbar"><button class="btn secondary" data-act="reset"' + (st.busy ? " disabled" : "") + '>Restore original settings</button></div>') + '</section>';

    return '<section class="stack-lg">' + head + msgs + general + careers + test + reset +
      '<p class="muted small">Changes only apply to students who start after you save, and each save gets a new settings version, so past responses stay with the settings they were scored under. This page is not linked from the survey; the password protects saving.</p></section>';
  }

  function tryPanel() {
    var cfg = clone(CFG); cfg.careers = st.draft.careers.map(function (c) { return { name: c.name || "(unnamed)", group: c.group, profile: c.profile.map(function (v) { return typeof v === "number" && isFinite(v) ? v : 3; }) }; });
    cfg.scoring = Object.assign({}, cfg.scoring, st.draft.scoring);
    var scores = CFG.skills.map(function (s, i) { return { id: s.id, name: s.name, short: s.short, score: st.tryScores[i] }; });
    var res, err = "";
    try {
      var matches = S.computeCareerMatches(cfg, scores);
      var t = Math.min(Number(cfg.scoring.topMatches) || 5, matches.length), b = Math.min(Number(cfg.scoring.bottomMatches) || 5, matches.length);
      res = { top: matches.slice(0, t), bottom: matches.slice().sort(function (x, y) { return y.gross - x.gross || x.order - y.order; }).slice(0, b), skills: S.computeTopSkills(cfg, scores, matches) };
    } catch (e) { err = e.message; }
    var sliders = CFG.skills.map(function (s, i) {
      return '<label>' + esc(s.name) + '<b>' + fmt(st.tryScores[i]) + '</b><input type="range" min="1" max="5" step="0.2" value="' + st.tryScores[i] + '" data-try="' + i + '" aria-label="' + esc(s.name) + '"></label>';
    }).join("");
    function list(items) { return '<ol class="shortlist">' + items.map(function (m) { return '<li><span>' + esc(m.name) + '</span><span class="dev">' + fmt(m.gross) + '</span></li>'; }).join("") + '</ol>'; }
    return '<section class="stack card"><div><h2>Try it out</h2><p class="muted small">Move the sliders to act like a student with those skill averages and see how your <em>unsaved</em> settings rank the careers. Nothing here is saved or sent.</p></div>' +
      '<div class="try-grid">' + sliders + '</div><div class="toolbar"><button class="btn link" data-act="try-reset">All 3.5</button><button class="btn link" data-act="try-random">Random student</button></div>' +
      (err ? '<div class="msg bad">' + esc(err) + '</div>' : '<div class="try-results"><div><h3>Top ' + res.top.length + '</h3>' + list(res.top) + '</div><div><h3>Bottom ' + res.bottom.length + '</h3>' + list(res.bottom) + '</div>' +
      '<div><h3>Top skills</h3><ol class="shortlist">' + res.skills.map(function (s) { return '<li><span>' + esc(s.name) + '</span><span class="dev">' + fmt(s.score) + '</span></li>'; }).join("") + '</ol></div></div>') + '</section>';
  }

  // ------------------------------------------------------------ events
  root.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "login-form") login(document.getElementById("pw").value);
  });

  function rowOf(el) { return st.draft.careers[Number(el.dataset.row)]; }
  // Text/number edits update state without re-rendering (keeps focus); only the highlight and bars refresh.
  root.addEventListener("input", function (e) {
    var t = e.target;
    if (t.dataset.try !== undefined) { st.tryScores[Number(t.dataset.try)] = Number(t.value); renderTry(); return; }
    if (t.dataset.scoring) { var v = t.dataset.int ? Number(t.value) : t.value; st.draft.scoring[t.dataset.scoring] = v; t.classList.toggle("changed", v !== st.saved.scoring[t.dataset.scoring]); refreshHeader(); renderTry(); return; }
    if (t.dataset.skill !== undefined) {
      var c = rowOf(t), k = Number(t.dataset.skill), n = t.value === "" ? NaN : Number(t.value);
      c.profile[k] = n; var o = originalOf(c); var bad = !(n >= 1 && n <= 5);
      t.classList.toggle("invalid", bad); t.classList.toggle("changed", !bad && !c._new && o && Number(o.profile[k]) !== n);
      refreshHeader(); renderTry(); return;
    }
    if (t.dataset.field) { rowOf(t)[t.dataset.field] = t.value; refreshHeader(); if (t.dataset.field === "name") renderTry(); }
  });
  root.addEventListener("change", function (e) {
    var t = e.target;
    // Update in place (no re-render): a re-render on blur would swallow the click the user is making, e.g. on Save.
    if (t.dataset.scoring) { st.draft.scoring[t.dataset.scoring] = t.dataset.int ? Number(t.value) : t.value; t.classList.toggle("changed", st.draft.scoring[t.dataset.scoring] !== st.saved.scoring[t.dataset.scoring]); refreshHeader(); renderTry(); }
    else if (t.dataset.field === "group") { var gr = rowOf(t); gr.group = t.value; var go = originalOf(gr); t.classList.toggle("changed", !gr._new && !!go && go.group !== t.value); refreshHeader(); }
    if (t.id === "import-file" && t.files[0]) importFile(t.files[0]);
  });

  function originalOf(c) { return st.saved.careers.filter(function (x) { return x.name === c._origName; })[0]; }
  function refreshHeader() {
    var s = root.querySelector(".admin-bar .state"); var isDirty = dirty();
    if (s) { s.className = "state" + (isDirty ? " dirty" : ""); s.textContent = isDirty ? "Unsaved changes" : "Saved settings in use"; }
    root.querySelectorAll('[data-act="save"],[data-act="discard"]').forEach(function (b) { b.disabled = !isDirty || st.busy; });
  }
  function renderTry() {
    var host = root.querySelector(".try-grid"); if (!host) return;
    var sec = host.closest("section"), fresh = document.createElement("div"); fresh.innerHTML = tryPanel();
    // keep the slider being dragged in place; replace the rest
    sec.querySelectorAll(".try-grid label").forEach(function (l, i) { l.querySelector("b").textContent = fmt(st.tryScores[i]); });
    var newRes = fresh.querySelector(".try-results, .msg"), oldRes = sec.querySelector(".try-results, .msg");
    if (newRes && oldRes) oldRes.replaceWith(newRes);
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.dataset.act, i = Number(b.dataset.row);
    if (act === "save") save();
    else if (act === "discard") { st.draft = clone(st.saved); st.error = ""; st.problemList = null; st.notice = ""; render(); }
    else if (act === "logout") logout();
    else if (act === "toggle") { st.draft.careers[i]._open = !st.draft.careers[i]._open; render(); }
    else if (act === "remove") {
      if (st.draft.careers.length <= 1) return;
      var c = st.draft.careers[i];
      if (window.confirm("Remove " + (c.name || "this career") + " from the survey results?")) { st.draft.careers.splice(i, 1); render(); }
    }
    else if (act === "add") {
      st.draft.careers.push({ name: "", group: CFG.careerGroups[0], category: "", description: "", profile: CFG.skills.map(function () { return 3; }), _new: true, _open: true });
      render(); var el = document.getElementById("n-" + (st.draft.careers.length - 1)); if (el) { el.focus(); el.scrollIntoView({ block: "center" }); }
    }
    else if (act === "reset") { st.resetConfirm = true; render(); }
    else if (act === "reset-no") { st.resetConfirm = false; render(); }
    else if (act === "reset-yes") resetToOriginal();
    else if (act === "try-reset") { st.tryScores = CFG.skills.map(function () { return 3.5; }); rerenderTrySliders(); }
    else if (act === "try-random") { st.tryScores = CFG.skills.map(function () { return Math.round((2 + Math.random() * 3) * 5) / 5; }); rerenderTrySliders(); }
    else if (act === "export") download();
  });
  function rerenderTrySliders() { render(); }

  function download() {
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), surveyVersion: CFG.baseVersion || CFG.version, settings: payload() }, null, 2)], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "career-scoring-settings.json"; document.body.appendChild(a); a.click(); a.remove();
  }
  function importFile(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result), o = data.settings || data;
        var errs = S.validateOverrides(CFG, o);
        if (errs.length) { st.error = "That file doesn't fit this survey:"; st.problemList = errs; }
        else { st.draft = fromOverrides(o); st.error = ""; st.problemList = null; st.notice = "Loaded from the file. Review the changes, then Save."; }
      } catch (e) { st.error = "That file couldn't be read."; st.problemList = null; }
      render();
    };
    r.readAsText(file);
  }

  if (st.token && CFG.backendUrl) resume(); else render();
})();
