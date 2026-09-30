/*
 * Survey app - screens, answers, results. All model logic lives in scoring.js,
 * all content/settings in config.js. Plain JavaScript, no build step.
 *
 * Screens: intro -> about you -> question pages (5 per page) -> results
 */
(function () {
  "use strict";
  var CFG = window.SURVEY_CONFIG;
  var S = window.SurveyScoring;
  var app = document.getElementById("app");
  var STORE_KEY = "bca-draft-" + CFG.version;
  var PREVIEW = !CFG.backendUrl;

  var cfgErrors = S.validateConfig(CFG);
  if (cfgErrors.length) {
    app.innerHTML = '<div class="notice"><strong>Settings problem in config.js</strong>' +
      cfgErrors.map(esc).join("<br>") + "</div>";
    return;
  }

  var pages = [];
  for (var i = 0; i < CFG.questions.length; i += CFG.questionsPerPage) pages.push(CFG.questions.slice(i, i + CFG.questionsPerPage));

  // ---------------------------------------------------------------- state
  var state = load() || { screen: "intro", page: 0, profile: {}, answers: {}, submissionId: null, submittedAt: null };
  var ui = { saveStatus: PREVIEW ? "preview" : "idle", emailStatus: "idle", emailMsg: "", confirmReset: false, showErrors: false };
  var savePromise = null;

  function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }
  function load() { try { var s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearDraft() { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return n == null ? "-" : n.toFixed(2); }
  function go(screen, page) {
    state.screen = screen; if (page != null) state.page = page;
    ui.showErrors = false; persist(); render(); window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- render
  function render() {
    var html = masthead();
    if (state.screen === "intro") html += intro();
    else if (state.screen === "profile") html += profile();
    else if (state.screen === "questions") html += questions();
    else html += results();
    html += '<footer>' + esc(CFG.contactLine) + ' <span class="muted">Model version ' + esc(CFG.version) + '</span></footer>';
    app.innerHTML = html;
  }

  function masthead() {
    return '<header class="masthead"><span class="org">' + esc(CFG.organization) + '</span>' +
      (PREVIEW ? '<span class="mode-tag" title="No backend connected in config.js">Preview mode: nothing is saved</span>' : "") + "</header>";
  }

  function intro() {
    var started = Object.keys(state.answers).length > 0;
    return '<section class="stack-lg">' +
      '<div class="stack"><p class="eyebrow">Career assessment</p><h1>' + esc(CFG.title) + '</h1>' +
      '<p class="lede">Rate ' + CFG.questions.length + ' statements about how you work. Your answers are scored across ' +
      CFG.skills.length + ' skill areas and compared with the skill profiles of ' + CFG.careers.length +
      ' banking careers. You\'ll see your results as soon as you finish.</p></div>' +
      '<dl class="facts">' +
      '<div><dt>' + CFG.questions.length + '</dt><dd>statements, about 10 minutes</dd></div>' +
      '<div><dt>' + CFG.skills.length + '</dt><dd>skill areas measured</dd></div>' +
      '<div><dt>' + CFG.careers.length + '</dt><dd>career paths compared</dd></div></dl>' +
      '<div class="notice"><strong>What happens to your answers</strong>Your name, answers and results are saved for the ' +
      esc(CFG.organization) + ' to review. If you ask for an emailed copy, your email address is used only to send it and is not stored.</div>' +
      '<p class="muted small">There are no right or wrong answers. Answer the way you actually work, not the way you think a banker should.</p>' +
      '<div class="actions"><button class="btn" data-act="start">' + (started ? "Continue where you left off" : "Start the survey") + '</button>' +
      (started ? '<button class="btn link" data-act="reset">Start over</button>' : "") + '</div>' +
      resetConfirm() + '</section>';
  }

  function profile() {
    var p = state.profile;
    var fields = CFG.profileQuestions.map(function (f) {
      var err = ui.showErrors && f.required && !hasValue(p[f.id]);
      var req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : "";
      var inner;
      if (f.type === "select") {
        inner = '<label for="f-' + f.id + '">' + esc(f.label) + req + '</label><select id="f-' + f.id + '" data-profile="' + f.id + '">' +
          '<option value="">Choose one</option>' +
          f.options.map(function (o) { return '<option' + (p[f.id] === o ? " selected" : "") + '>' + esc(o) + '</option>'; }).join("") + '</select>';
      } else if (f.type === "checkbox") {
        var cur = p[f.id] || [];
        return '<fieldset class="field"><legend>' + esc(f.label) + req + '</legend><div class="checks">' +
          f.options.map(function (o, i) {
            return '<label><input type="checkbox" id="f-' + f.id + '-' + i + '" data-profile-check="' + f.id + '" value="' + esc(o) + '"' +
              (cur.indexOf(o) > -1 ? " checked" : "") + '>' + esc(o) + '</label>';
          }).join("") + '</div>' + (err ? '<span class="error">Select at least one.</span>' : "") + '</fieldset>';
      } else if (f.type === "textarea") {
        inner = '<label for="f-' + f.id + '">' + esc(f.label) + req + '</label><textarea id="f-' + f.id + '" data-profile="' + f.id + '">' + esc(p[f.id] || "") + '</textarea>';
      } else {
        inner = '<label for="f-' + f.id + '">' + esc(f.label) + req + '</label><input type="text" id="f-' + f.id + '" data-profile="' + f.id + '" value="' + esc(p[f.id] || "") + '" autocomplete="' + (f.id === "name" ? "name" : "off") + '">';
      }
      return '<div class="field">' + inner + (err ? '<span class="error">This one is required.</span>' : "") + '</div>';
    }).join("");
    return '<section class="stack-lg"><div class="stack"><p class="eyebrow">Step 1 of 2</p><h2>About you</h2></div>' +
      '<form id="profile-form" class="stack" novalidate>' + fields + '</form>' +
      '<div class="actions"><button class="btn secondary" data-act="back-intro">Back</button><button class="btn" data-act="profile-next">Next: the survey</button></div></section>';
  }

  function hasValue(v) { return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }

  function questions() {
    var pg = pages[state.page];
    var answered = Object.keys(state.answers).length;
    var total = CFG.questions.length;
    var offset = state.page * CFG.questionsPerPage;
    var items = pg.map(function (q, qi) {
      var val = state.answers[q.id];
      var missing = ui.showErrors && typeof val !== "number";
      return '<fieldset class="q' + (missing ? " missing" : "") + '"><legend><span class="q-num">' + (offset + qi + 1) + '.</span>' + esc(q.text) + '</legend>' +
        '<div class="scale">' + CFG.scale.map(function (opt) {
          var id = "q-" + q.id + "-" + opt.value;
          return '<input type="radio" name="q-' + esc(q.id) + '" id="' + esc(id) + '" value="' + opt.value + '" data-q="' + esc(q.id) + '"' + (val === opt.value ? " checked" : "") + '>' +
            '<label for="' + esc(id) + '"><b>' + opt.value + '</b>' + esc(opt.label) + '</label>';
        }).join("") + '</div>' +
        '<div class="scale-ends"><span>' + esc(CFG.scale[0].label) + '</span><span>' + esc(CFG.scale[CFG.scale.length - 1].label) + '</span></div>' +
        (missing ? '<p class="error" style="margin-top:8px">Choose an answer to continue.</p>' : "") + '</fieldset>';
    }).join("");
    var last = state.page === pages.length - 1;
    return '<section class="stack-lg"><div class="progress" aria-live="polite"><div class="progress-row"><span>Section ' + (state.page + 1) + ' of ' + pages.length +
      '</span><span>' + answered + ' of ' + total + ' answered</span></div><div class="bar"><span style="width:' + (answered / total * 100) + '%"></span></div></div>' +
      '<p class="muted small">Step 2 of 2. How much do you agree with each statement?</p>' +
      '<div class="stack">' + items + '</div>' +
      '<div class="actions"><button class="btn secondary" data-act="q-back">Back</button>' +
      '<button class="btn" data-act="q-next">' + (last ? "See my results" : "Next") + '</button></div></section>';
  }

  function resetConfirm() {
    if (!ui.confirmReset) return "";
    return '<div class="notice confirm"><span>Clear your answers and start over?</span><button class="btn" data-act="reset-yes">Clear answers</button><button class="btn secondary" data-act="reset-no">Keep them</button></div>';
  }

  // ---------------------------------------------------------------- results
  function results() {
    var r = S.scoreSurvey(CFG, state.answers);
    var first = (state.profile.name || "").trim().split(/\s+/)[0];
    var maxGross = Math.max.apply(null, r.matches.map(function (m) { return m.gross; }).concat([1]));
    var topNames = r.topMatches.map(function (m) { return m.name; });
    var bottomNames = r.bottomMatches.map(function (m) { return m.name; });

    var skillsHtml = r.topSkills.map(function (s, i) {
      return '<div class="skill-card"><span class="rank">#' + (i + 1) + '</span><span class="name">' + esc(s.name) + '</span><span class="score">' + fmt(s.score) + ' / 5</span></div>';
    }).join("");
    var tied = r.tiedSkills.length ? '<p class="muted small">Also tied at ' + fmt(r.topSkills[r.topSkills.length - 1].score) + ': ' +
      r.tiedSkills.map(function (s) { return esc(s.name); }).join(", ") + '.</p>' : "";

    function shortlist(list, cls) {
      return '<ol class="shortlist ' + cls + '">' + list.map(function (m) {
        return '<li><span>' + esc(m.name) + '</span><span class="dev">' + fmt(m.gross) + '</span></li>';
      }).join("") + '</ol>';
    }

    var profileBars = r.skillScores.map(function (s) {
      var pct = s.score == null ? 0 : (s.score - 1) / 4 * 100;
      return '<div class="prow"><span>' + esc(s.name) + '</span><div class="ptrack" role="img" aria-label="' + esc(s.name) + ' ' + fmt(s.score) + ' out of 5"><span style="width:' + pct + '%"></span></div><span class="pval">' + fmt(s.score) + '</span></div>';
    }).join("");

    var ledger = r.matches.map(function (m) {
      var cls = topNames.indexOf(m.name) > -1 ? "is-top" : bottomNames.indexOf(m.name) > -1 ? "is-bottom" : "";
      var fit = Math.max(4, (1 - m.gross / maxGross) * 100 + 8);
      var rows = CFG.skills.map(function (sk, i) {
        var d = m.deviations[i];
        return '<tr><td>' + esc(sk.name) + '</td><td>' + fmt(r.skillScores[i].score) + '</td><td>' + m.profile[i] + '</td><td class="' + (d > 0 ? "pos" : d < 0 ? "neg" : "") + '">' + (d > 0 ? "+" : "") + fmt(d) + '</td></tr>';
      }).join("");
      return '<details class="' + cls + '"><summary><span class="rk">' + m.rank + '</span><span class="cname">' + esc(m.name) +
        '<span class="grp">' + esc(m.group) + (m.category ? " · " + esc(m.category) : "") + '</span></span><span class="dv">' + fmt(m.gross) +
        '</span><span class="fit" aria-hidden="true"><span style="width:' + Math.min(100, fit) + '%"></span></span></summary>' +
        '<div class="breakdown">' + (m.description ? '<p class="small muted" style="margin-bottom:8px">' + esc(m.description) + '</p>' : "") +
        '<table><thead><tr><th>Skill</th><th>You</th><th>Ideal</th><th>Difference</th></tr></thead><tbody>' + rows +
        '</tbody></table><p class="small muted" style="margin-top:6px">Deviation ' + fmt(m.gross) + ' is the sum of the differences, ignoring + and -.</p></div></details>';
    }).join("");

    return '<section class="stack-lg">' +
      '<div class="stack"><p class="eyebrow">Your results' + (state.submittedAt ? " · " + esc(new Date(state.submittedAt).toLocaleDateString()) : "") + '</p>' +
      '<h1>' + (first ? esc(first) + ", here's" : "Here's") + ' where you fit in banking</h1><p class="lede">' + esc(CFG.resultsIntro) + '</p>' + saveStatus() + '</div>' +

      '<div class="stack"><h2>Your top ' + r.topSkills.length + ' skill areas</h2><div class="skills-top">' + skillsHtml + '</div>' + tied + '</div>' +

      '<div class="split"><div><h3 style="margin-bottom:10px">Top ' + r.topMatches.length + ' career matches</h3><div class="list-head"><span>Career path</span><span>Deviation</span></div>' + shortlist(r.topMatches, "top") + '</div>' +
      '<div><h3 style="margin-bottom:10px">Bottom ' + r.bottomMatches.length + ' career matches</h3><div class="list-head"><span>Career path</span><span>Deviation</span></div>' + shortlist(r.bottomMatches, "bottom") + '</div></div>' +

      '<div class="stack"><h2>Your skill profile</h2><p class="muted small">Average of your five answers in each area, on the 1 to 5 scale.</p><div class="profile">' + profileBars +
      '<div class="paxis"><div></div><div><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div><div></div></div></div></div>' +

      '<div class="stack"><h2>All ' + r.matches.length + ' career paths, ranked</h2><p class="muted small">Lower deviation means a closer match. Select a career to see how your skills compare with its ideal profile.</p>' +
      '<div><div class="ledger-head"><span>#</span><span>Career path</span><span>Deviation</span><span>Fit</span></div><div class="ledger">' + ledger + '</div></div></div>' +

      emailPanel() +
      '<div class="actions no-print"><span>' + (window.PREVIEW_BUILD ? "" : '<button class="btn secondary" data-act="print">Print or save as PDF</button>') + '</span><button class="btn link" data-act="reset">Take the survey again</button></div>' +
      resetConfirm() + '</section>';
  }

  function saveStatus() {
    var map = {
      preview: ['warn', 'Preview mode: these results are not being saved.'],
      idle: ['', 'Saving your results...'],
      saving: ['', 'Saving your results...'],
      saved: ['ok', 'Your results were saved for the ' + esc(CFG.organization) + '.'],
      error: ['bad', 'Your results could not be saved. Check your connection and try again. <button class="btn link" data-act="retry-save">Try again</button>']
    };
    var m = map[ui.saveStatus] || map.idle;
    return '<p class="status no-print"><span class="dot ' + m[0] + '"></span><span>' + m[1] + '</span></p>';
  }

  function emailPanel() {
    var domains = CFG.allowedEmailDomains || [];
    var hint = domains.length ? "Use your @" + domains.join(" or @") + " address." : "";
    var msg = "";
    if (ui.emailStatus === "sending") msg = '<p class="status"><span class="dot"></span>Sending...</p>';
    if (ui.emailStatus === "sent") msg = '<p class="status"><span class="dot ok"></span>' + esc(ui.emailMsg) + '</p>';
    if (ui.emailStatus === "error") msg = '<p class="status"><span class="dot bad"></span>' + esc(ui.emailMsg) + '</p>';
    return '<div class="panel stack email-panel no-print"><h3>Email me a copy</h3>' +
      '<p class="muted small">' + esc(hint) + ' Your address is only used to send this copy and is not saved.</p>' +
      '<form class="email-row" id="email-form" novalidate><label for="email-input" class="sr-only" style="position:absolute;left:-9999px">Email address</label>' +
      '<input type="email" id="email-input" placeholder="firstname.lastname@' + esc(domains[0] || "example.edu") + '" autocomplete="email">' +
      '<button class="btn" type="submit"' + (ui.emailStatus === "sending" ? " disabled" : "") + '>Send copy</button></form>' + msg + '</div>';
  }

  // ---------------------------------------------------------------- backend
  function post(payload) {
    // text/plain avoids a CORS preflight, which Google Apps Script web apps don't answer.
    return fetch(CFG.backendUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(function (data) { if (!data || !data.ok) throw new Error((data && data.error) || "Unknown error"); return data; });
  }

  function buildRecord() {
    var r = S.scoreSurvey(CFG, state.answers);
    var skills = {}; r.skillScores.forEach(function (s) { skills[s.short] = s.score; });
    var careers = {}; CFG.careers.forEach(function (c) {
      var m = r.matches.filter(function (x) { return x.name === c.name; })[0]; careers[c.name] = m.gross;
    });
    return {
      action: "save",
      submissionId: state.submissionId,
      submittedAt: state.submittedAt,
      configVersion: CFG.version,
      profile: state.profile,
      answers: state.answers,
      questionOrder: CFG.questions.map(function (q) { return q.id; }),
      skillScores: skills,
      careerDeviations: careers,
      topSkills: r.topSkills.map(function (s) { return s.name; }),
      topMatches: r.topMatches.map(function (m) { return { name: m.name, gross: m.gross }; }),
      bottomMatches: r.bottomMatches.map(function (m) { return { name: m.name, gross: m.gross }; }),
      ranking: r.matches.map(function (m) { return { rank: m.rank, name: m.name, gross: m.gross }; })
    };
  }

  function save() {
    if (PREVIEW) return Promise.resolve();
    ui.saveStatus = "saving"; render();
    savePromise = post(buildRecord()).then(function () {
      ui.saveStatus = "saved"; state.saved = true; persist(); render();
    }, function (err) {
      ui.saveStatus = "error"; render(); console.error("Save failed:", err); throw err;
    });
    return savePromise;
  }

  function sendEmail(address) {
    var domains = (CFG.allowedEmailDomains || []).map(function (d) { return d.toLowerCase(); });
    var clean = String(address || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return emailError("Enter a valid email address.");
    if (domains.length && !domains.some(function (d) { return clean.slice(-(d.length + 1)) === "@" + d; }))
      return emailError("Use your @" + domains.join(" or @") + " address.");
    if (PREVIEW) return emailError("Preview mode: email isn't connected yet, so nothing was sent.");
    ui.emailStatus = "sending"; render();
    var ready = state.saved ? Promise.resolve() : (savePromise || save());
    ready.then(function () { return post({ action: "email", submissionId: state.submissionId, email: clean }); })
      .then(function () { ui.emailStatus = "sent"; ui.emailMsg = "Sent to " + clean + ". It may take a minute to arrive."; render(); })
      .catch(function (err) { emailError("The email could not be sent: " + err.message); });
  }
  function emailError(msg) { ui.emailStatus = "error"; ui.emailMsg = msg; render(); }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  // ---------------------------------------------------------------- events
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.q) { state.answers[t.dataset.q] = Number(t.value); persist();
      var pr = app.querySelector(".progress-row span:last-child"), bar = app.querySelector(".bar > span");
      var n = Object.keys(state.answers).length;
      if (pr) pr.textContent = n + " of " + CFG.questions.length + " answered";
      if (bar) bar.style.width = (n / CFG.questions.length * 100) + "%";
      var fs = t.closest(".q"); if (fs && fs.classList.contains("missing")) { fs.classList.remove("missing"); var er = fs.querySelector(".error"); if (er) er.remove(); }
    }
    if (t.dataset.profile) { state.profile[t.dataset.profile] = t.value; persist(); }
    if (t.dataset.profileCheck) {
      var id = t.dataset.profileCheck;
      state.profile[id] = Array.prototype.slice.call(app.querySelectorAll('[data-profile-check="' + id + '"]:checked')).map(function (c) { return c.value; });
      persist();
    }
  });
  app.addEventListener("input", function (e) {
    var t = e.target; if (t.dataset.profile) { state.profile[t.dataset.profile] = t.value; persist(); }
  });
  app.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "email-form") sendEmail(document.getElementById("email-input").value);
  });
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.dataset.act;
    if (act === "start") go(state.submissionId ? "results" : (hasValue(state.profile.name) ? "questions" : "profile"));
    else if (act === "back-intro") go("intro");
    else if (act === "profile-next") {
      var ok = CFG.profileQuestions.every(function (f) { return !f.required || hasValue(state.profile[f.id]); });
      if (!ok) { ui.showErrors = true; render(); var err = app.querySelector(".error"); if (err) err.scrollIntoView({ block: "center" }); return; }
      go("questions", state.page || 0);
    }
    else if (act === "q-back") { if (state.page === 0) go("profile"); else go("questions", state.page - 1); }
    else if (act === "q-next") {
      var missing = pages[state.page].filter(function (q) { return typeof state.answers[q.id] !== "number"; });
      if (missing.length) { ui.showErrors = true; render(); var m = app.querySelector(".q.missing"); if (m) m.scrollIntoView({ block: "center" }); return; }
      if (state.page < pages.length - 1) go("questions", state.page + 1);
      else {
        state.submissionId = state.submissionId || newId();
        state.submittedAt = state.submittedAt || new Date().toISOString();
        go("results");
        save().catch(function () { /* status shown on page */ });
      }
    }
    else if (act === "retry-save") save().catch(function () {});
    else if (act === "print") window.print();
    else if (act === "reset") { ui.confirmReset = true; render(); }
    else if (act === "reset-no") { ui.confirmReset = false; render(); }
    else if (act === "reset-yes") {
      clearDraft(); ui = { saveStatus: PREVIEW ? "preview" : "idle", emailStatus: "idle", emailMsg: "", confirmReset: false, showErrors: false };
      state = { screen: "intro", page: 0, profile: {}, answers: {}, submissionId: null, submittedAt: null }; render(); window.scrollTo(0, 0);
    }
  });

  if (state.screen === "results" && state.saved) ui.saveStatus = "saved";
  render();
  // Page was reloaded after finishing but before the save went through: try again.
  if (state.screen === "results" && !state.saved && !PREVIEW) save().catch(function () {});

  // Handy for testing in the browser console: SurveyDev.fill(3) answers every question with 3.
  window.SurveyDev = {
    fill: function (v) { CFG.questions.forEach(function (q) { state.answers[q.id] = v || Math.ceil(Math.random() * 5); }); persist(); render(); },
    state: function () { return state; }
  };
})();
