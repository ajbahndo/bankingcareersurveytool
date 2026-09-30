# Banking Career Assessment (web survey)

An online version of the NDSU Center for Banking and Finance **Banking Career Assessment Tool** (the Excel workbook).
Students answer the 50-statement survey. The site scores their answers with the same model as the workbook,
shows their results right away, and can email them a copy. Each response is saved to a Google Sheet for the professor.

**Live preview:** https://ajbahndo.github.io/bankingcareersurveytool/

> Status: working prototype (model version `2026.1`), connected to the responses Google Sheet. It matches the Excel results for every student sheet tested.
> This is meant to keep changing. See **Roadmap** below.

---

## How it fits together

```
Student's browser (GitHub Pages)                    Google (Apps Script + Sheet)
┌──────────────────────────────────┐   save   ┌────────────────────────────────────┐
│ index.html  - survey screens     │ ───────▶ │ Code.gs  - adds a row per student  │
│ js/config.js - questions, skills,│          │ Sheet tab "Responses v2026.1"      │
│               careers, settings  │  email   │                                    │
│ js/scoring.js - the Excel model  │ ───────▶ │ Code.gs  - emails results (address │
│ js/app.js    - screens & results │          │            is not stored)          │
└──────────────────────────────────┘          └────────────────────────────────────┘
```

| File | What it is | Who edits it |
|---|---|---|
| `js/config.js` | Questions, 10 skills, 27 career profiles, answer scale, "About you" questions, settings | **Edit this for model changes** |
| `js/scoring.js` | Scoring engine. Reproduces the workbook formulas | Rarely |
| `js/app.js` | Survey screens and results page | For layout/feature changes |
| `css/styles.css` | Look and feel | For design changes |
| `apps-script/Code.gs` | Backend: saves responses, sends emailed copies | Once at setup |
| `tests/verify-scoring.js` | Checks the site's math against the Excel workbook | Run after model changes |

---

## How the model works (same as the Excel workbook)

1. **Skill scores.** Each of the 10 skills has 5 statements rated 1–5. The skill score is the average of those 5 answers.
   (Workbook: student sheet `H48:I57`, copied to `B4:K4`.)
2. **Deviation from each career.** Each career has an "ideal" 1–5 rating for every skill (Scoring Template).
   For each skill: *student score − ideal*. (Workbook columns `M:V`.)
3. **Gross deviation.** Add up those differences **ignoring + and −**. (Workbook column `Y`, `=SUM(ABS(M:V))`.)
   Lower means a closer match. The workbook also computes a **net deviation** (column `X`, signed sum), but it isn't used for ranking.
4. **Ranking.** Top 5 careers have the smallest gross deviation, and the bottom 5 have the largest. Ties keep the workbook's row order, the same as Excel.

Example from Avery's sheet, Credit Analyst:

| Skill | Avery | Ideal | Difference |
|---|---|---|---|
| Rel Mgmt | 3.8 | 2 | +1.8 |
| Analysis | 4.2 | 4 | +0.2 |
| Problem Solving | 4.6 | 4 | +0.6 |
| Written | 4.0 | 4 | 0 |
| Verbal | 3.8 | 3 | +0.8 |
| Organization | 3.2 | 4 | −0.8 |
| Teamwork | 3.8 | 3 | +0.8 |
| Professionalism | 4.8 | 4 | +0.8 |
| Time Mgmt | 4.6 | 4 | +0.6 |
| Attn to Detail | 4.8 | 5 | −0.2 |
| **Gross deviation** | | | **6.60** (#1 match) |

**Top 3 skills** are the 3 highest skill averages. Ties are broken by survey order, which reproduces the professor's emailed results.
Other skills tied with #3 are listed as "Also tied" on the results page. To use a different rule, set `scoring.skillTieBreak` in `config.js`
(`"topCareerRelevance"` favors the skill the student's top career matches rely on most).

---

## Setup

### 1. Put the site on GitHub Pages
1. Upload everything in this folder to the repo (GitHub → **Add file → Upload files**, drag the folder contents in, then **Commit**).
   Keep the folder structure: `index.html` at the top level, with `js/`, `css/` and `apps-script/` folders.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)` → **Save**.
3. After about a minute the site is live at `https://<username>.github.io/<repo-name>/`.
   Until step 2 is done it runs in **preview mode**, where nothing is saved or emailed.

> A free GitHub account makes the **code** of a public repo visible to anyone, but not the responses. Those only live in the Google Sheet.
> GitHub Pages on a private repo needs a paid plan. The page is set to `noindex`, so search engines shouldn't list it.

### 2. Connect the Google Sheet (saving + emailed copies)
Do this from the Google account that should **own the data and send the emails**. Ideally that's the professor's or the Center's account, not a personal one.
1. Create a new Google Sheet, e.g. "Banking Career Assessment – Responses".
2. **Extensions → Apps Script**. Delete the sample code, paste in `apps-script/Code.gs`, and click **Save**.
   (Or create a standalone script at script.new and put the Sheet's ID, the long code in its URL, into `SETTINGS.spreadsheetId`. The current preview is set up this way.)
3. In `SETTINGS` at the top, set `replyTo` to the professor's email if replies should go to him.
4. Select the `testSetup` function and click **Run**. Approve the permissions (Sheets + send email). A tab named `Responses vtest` appears with a test row, which you can delete.
5. **Deploy → New deployment →** type **Web app**. Execute as: **Me**. Who has access: **Anyone** → **Deploy**. Copy the **Web app URL**.
6. In `js/config.js`, paste that URL into `backendUrl: ""`, then commit the change on GitHub.
7. Take the survey once on the live site. A row should appear in `Responses v2026.1`, and an emailed copy should arrive.

> After editing `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the same URL picks up the change.

### What gets saved
One row per student: timestamp, submission ID, model version, name, school status, major(s), minors, all 50 answers (columns `S-1` … `AD-5`),
10 skill scores, gross deviation for all 27 careers (same order as the workbook's **Results Summary** tab), top 3 skills, top 5 and bottom 5 matches,
and a count of emailed copies. **Email addresses are not saved.**

---

## Changing the model

Everything is in `js/config.js`:
- **Edit a career's profile**: change its 10 numbers (order: Rel Mgmt, Analysis, Problem Solving, Written, Verbal, Organization, Teamwork, Professionalism, Time Mgmt, Attn to Detail).
- **Add a career**: copy a line in `careers` and edit it. An optional `description` shows on the results page.
- **Add a skill**: add it to `skills`, add its questions to `questions`, and add one more number to *every* career.
- **Edit "About you" answer choices**: `profileQuestions`. The school-status and major lists are placeholders to confirm with the professor.
- **Bump `version`** whenever questions, skills or careers change. New responses then go to a new sheet tab, so versions don't mix.

Then run the check. You need [Node.js](https://nodejs.org) installed:
```
node tests/verify-scoring.js
```
It confirms the settings file is consistent and that scores still match the workbook for Avery B, Ben M, Cayler R and Dane T.
If you intentionally change a career profile, the Excel comparisons for that career will fail. Update the expected values, or add new expected results from the updated workbook.

---

## Roadmap (professor's 2026 notes and open items)

- [ ] **Cash Management fix.** It's in the top 2 for all four students tested. Its profile is all 3s–5s, close to how most students rate themselves, and the model counts scoring *above* the ideal as much as scoring below it. Options: tighten the profile, or try `scoring.deviationMethod: "shortfall"` (only counts skills where the student falls short). That's an experiment and doesn't match the Excel model.
- [ ] **Career categories**: Risk & insurance, Credit & lending, Retirement & wealth management, Real estate & valuation, Operations & compliance. The `category` field on each career and the `careerCategories` list are ready. The results page shows a category once one is filled in. Grouped results views are still to do.
- [ ] **New paths**: technology, HR/culture, separate sales roles, Investment Banker, AI Analyst.
- [ ] **New skills** (Academic Committee 4/17): collaboration, agility, innovation, more soft skills. Look for positions with no 5s and add skills they need.
- [ ] Connect questions to course learning objectives.
- [ ] Confirm answer choices for school status and majors.
- [ ] Optional admin view or export that matches the Results Summary layout.
- [ ] Decide long-term hosting (GitHub Pages vs NDSU).

## Notes and limits
- The save/email URL is public (any web app URL is). Emails can only go to the allowed domain, can only contain results already saved, and are capped at 3 per submission.
- Google limits emails from a regular account to about 100 per day (more on Google Workspace accounts).
- Answers are kept in the student's browser until they finish, so a refresh doesn't lose progress.
- Question text is from the workbook's Sheet2, with a few spelling fixes (statistics, conciseness, professional).
