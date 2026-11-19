# Obsidian note updates: Professor settings page

Paste each section into the matching note in `Banking Career Assessment/`.

## Recent Changes.md  (add at the top)
**2026-11-19: Professor-only scoring settings page**
- New `admin.html` (+ `js/admin.js`, `css/admin.css`): password-protected page where the professor edits career ideal ratings (1-5 per skill), adds/removes/renames careers, and changes scoring options (deviation method, # of top/bottom matches, # of top skills, top-skill tie-break). Includes a "Try it out" panel, JSON backup/restore, and "Restore original settings".
- `apps-script/Code.gs`: new public `GET ?action=config` (survey reads current settings) and password-checked `adminLogin / adminLoad / adminSave / adminReset / adminLogout`. Settings live in Script Properties (`SCORING_OVERRIDES`); password in Script Property `ADMIN_PASSWORD`.
- `js/scoring.js`: new `validateOverrides` / `applyOverrides`. `js/app.js` loads saved settings at start (falls back to `config.js` if the backend is unreachable, 5 s timeout).
- Model version now gets a revision suffix after each save (`2026.1-r3`) so each settings version gets its own Responses tab. Past responses are never rescored.
- `tests/verify-scoring.js`: 6 new checks for the settings logic. Excel comparisons still pass.

## Memory/Decisions.md
- **Admin access = server-side password, not a hidden URL.** GitHub Pages is static, so the only real protection is the Apps Script backend checking `ADMIN_PASSWORD`. `admin.html` is also unlinked + `noindex`. Lockout after 5 wrong tries (15 min); sessions 6 h.
- **Ratings are not secret.** They ship to students' browsers (needed to score) and were already in `config.js`. Only *editing* is protected.
- **Skills and questions are NOT editable in the admin page.** Changing them changes every career profile, so that stays in `config.js`.
- **Each save bumps a revision** -> model version `base-rN` -> separate Responses tab, so results from different criteria never mix.
- Survey falls back to `config.js` defaults if settings can't load (response is then tagged with the base version).

## Memory/How the Model Works.md
Add: "Career ideal ratings and scoring options can be overridden by the professor on `admin.html`. The survey applies the saved overrides on top of `config.js` at load. Result math is unchanged: skill score = average of 5 answers; deviation = student - ideal; gross = sum of |deviation| (or shortfall-only if the professor selects that); lowest gross = best match."

## Memory/Links and Accounts.md
- Professor settings page: `https://ajbahndo.github.io/bankingcareersurveytool/admin.html`
- Admin password: stored ONLY in Apps Script -> Project Settings -> Script properties -> `ADMIN_PASSWORD` (do not write the password in this vault).

## Memory/Technical Setup.md
One-time after deploying the new `Code.gs`: add `ADMIN_PASSWORD` script property, then Deploy -> Manage deployments -> Edit -> New version. Test: sign in at `admin.html`, save a small change, reload the survey, footer shows `Model version 2026.1-rN`.

## Next Steps.md
- [ ] Set `ADMIN_PASSWORD` + redeploy the Apps Script (see Technical Setup)
- [ ] Give the professor the admin link + password (separately)
- [ ] Professor: tighten Cash Management profile on the new page (Roadmap item)
- [ ] Decide whether to add an "edit questions/skills" admin view later
- [ ] Optional: audit log of who changed what / when (currently only revision + timestamp)
