/*
 * Scoring engine - reproduces the professor's Excel model.
 *
 * Excel equivalent (per student sheet, e.g. "Avery B"):
 *   Skill score (I48:I57)   = AVERAGE of the 5 answers for that skill
 *   Deviation   (M8:V36)    = student skill score - career's ideal score
 *   Net Dev     (X8:X36)    = SUM of deviations  (signed)
 *   Gross Dev   (Y8:Y36)    = SUM(ABS(deviations))   <- used for ranking
 *   Top 5       (AD8:AD12)  = 5 careers with the SMALLEST gross deviation
 *   Bottom 5    (AD16:AD20) = 5 careers with the LARGEST gross deviation
 *
 * Pure functions, no page access, so it runs in the browser and in Node (tests).
 */
(function (root) {
  // Round away floating-point noise (Excel shows 7.3999999 for 7.4) so ties compare correctly.
  function clean(n) { return Math.round(n * 1e6) / 1e6; }

  function average(values) {
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return values.length ? sum / values.length : null;
  }

  /** answers: { "S-1": 5, "S-2": 2, ... }  ->  [{id, name, short, score, answered, total}] */
  function computeSkillScores(config, answers) {
    return config.skills.map(function (skill) {
      var qs = config.questions.filter(function (q) { return q.skill === skill.id; });
      var vals = qs.map(function (q) { return answers[q.id]; }).filter(function (v) { return typeof v === "number"; });
      return {
        id: skill.id, name: skill.name, short: skill.short,
        score: vals.length ? clean(average(vals)) : null,
        answered: vals.length, total: qs.length
      };
    });
  }

  /** Returns every career with its per-skill deviations, net and gross deviation, sorted best match first. */
  function computeCareerMatches(config, skillScores) {
    var method = (config.scoring && config.scoring.deviationMethod) || "absolute";
    var list = config.careers.map(function (career, order) {
      var deviations = career.profile.map(function (ideal, i) {
        var s = skillScores[i].score;
        return s === null ? 0 : clean(s - ideal);
      });
      var net = 0, gross = 0;
      deviations.forEach(function (d) {
        net += d;
        if (method === "shortfall") gross += d < 0 ? -d : 0;
        else gross += Math.abs(d);
      });
      return {
        name: career.name, group: career.group, category: career.category || null,
        description: career.description || "", profile: career.profile,
        deviations: deviations, net: clean(net), gross: clean(gross), order: order
      };
    });
    // Stable: ties keep workbook order (same as Excel SMALL/INDEX-MATCH picking the first row).
    list.sort(function (a, b) { return a.gross - b.gross || a.order - b.order; });
    list.forEach(function (c, i) { c.rank = i + 1; });
    return list;
  }

  /** Top skills with the tie-break described in config.scoring.skillTieBreak. */
  function computeTopSkills(config, skillScores, matches) {
    var n = config.scoring.topSkills || 3;
    var topN = matches.slice(0, config.scoring.topMatches || 5);
    var ranked = skillScores.map(function (s, i) {
      var relevance = 0;
      topN.forEach(function (c) { relevance += c.profile[i]; });
      return { id: s.id, name: s.name, short: s.short, score: s.score, relevance: relevance, order: i };
    });
    var useRelevance = config.scoring.skillTieBreak === "topCareerRelevance";
    ranked.sort(function (a, b) {
      return (b.score - a.score) ||
        (useRelevance ? b.relevance - a.relevance : 0) ||
        (a.order - b.order);
    });
    var top = ranked.slice(0, n);
    // Skills left out only because of a tie with the last top skill - shown as "tied" on the results page.
    var cutoff = top.length ? top[top.length - 1].score : null;
    top.tiedOut = ranked.slice(n).filter(function (s) { return s.score === cutoff; });
    return top;
  }

  function isComplete(config, answers) {
    return config.questions.every(function (q) { return typeof answers[q.id] === "number"; });
  }

  /** One call to get everything the results page and the saved record need. */
  function scoreSurvey(config, answers) {
    var skillScores = computeSkillScores(config, answers);
    var matches = computeCareerMatches(config, skillScores);
    var topSkills = computeTopSkills(config, skillScores, matches);
    var t = config.scoring.topMatches || 5, b = config.scoring.bottomMatches || 5;
    return {
      configVersion: config.version,
      complete: isComplete(config, answers),
      skillScores: skillScores,
      matches: matches,
      topMatches: matches.slice(0, t),
      // Worst first, like the email. Ties keep workbook order (Excel LARGE/INDEX-MATCH behaviour).
      bottomMatches: matches.slice().sort(function (x, y) { return y.gross - x.gross || x.order - y.order; }).slice(0, b),
      topSkills: topSkills,
      tiedSkills: topSkills.tiedOut
    };
  }

  /** Sanity-check the settings file (mismatched profile lengths, unknown skills, duplicate ids). */
  function validateConfig(config) {
    var errors = [];
    var skillIds = config.skills.map(function (s) { return s.id; });
    var seen = {};
    config.questions.forEach(function (q) {
      if (skillIds.indexOf(q.skill) === -1) errors.push("Question " + q.id + " uses unknown skill '" + q.skill + "'");
      if (seen[q.id]) errors.push("Duplicate question id " + q.id);
      seen[q.id] = true;
    });
    config.skills.forEach(function (s) {
      if (!config.questions.some(function (q) { return q.skill === s.id; })) errors.push("Skill '" + s.id + "' has no questions");
    });
    config.careers.forEach(function (c) {
      if (c.profile.length !== config.skills.length)
        errors.push("Career '" + c.name + "' has " + c.profile.length + " ratings but there are " + config.skills.length + " skills");
    });
    return errors;
  }

  var api = {
    computeSkillScores: computeSkillScores,
    computeCareerMatches: computeCareerMatches,
    computeTopSkills: computeTopSkills,
    scoreSurvey: scoreSurvey,
    isComplete: isComplete,
    validateConfig: validateConfig
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SurveyScoring = api;
})(this);
