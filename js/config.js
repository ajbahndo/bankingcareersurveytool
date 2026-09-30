/*
 * ============================================================================
 *  BANKING CAREER ASSESSMENT - SURVEY SETTINGS
 * ============================================================================
 *  This is the ONLY file that needs to change when the model changes.
 *  It mirrors the professor's Excel workbook:
 *
 *    skills     -> Scoring Template B3:K4   (the 10 skill areas)
 *    questions  -> Sheet2 A4:G53           (question text + which skill it measures)
 *    careers    -> Scoring Template A5:K36  (ideal 1-5 rating for each skill)
 *
 *  To add a career: copy one line in `careers`, change the name and the ten
 *  numbers (same order as `skills`).
 *  To add a skill: add it to `skills`, add its questions, and add one more
 *  number to EVERY career's `profile` (the test script will catch mismatches).
 *
 *  Bump `version` whenever questions, skills, or careers change so saved
 *  responses from different versions are kept on separate sheet tabs.
 * ============================================================================
 */
(function (root) {
  var SURVEY_CONFIG = {
    version: "2026.1",
    title: "Banking Career Assessment",
    organization: "NDSU Center for Banking and Finance",

    // ------------------------------------------------------------------------
    // Connections (fill in after deploying apps-script/Code.gs - see README)
    // Leave blank to run in "preview mode": nothing is saved or emailed.
    // ------------------------------------------------------------------------
    backendUrl: "https://script.google.com/macros/s/AKfycbyEe0ylvBCjydeX7AvkjUdnIH11gv6jF6OWSmX7dheTtQf9-Isx_axeCgd8rg2VL_zU/exec",

    // Emailed copies are only sent to addresses ending in one of these
    // domains. Keep it to the university address unless told otherwise.
    // Use [] to allow any address. (Also enforced on the server.)
    allowedEmailDomains: ["ndsu.edu"],

    // ------------------------------------------------------------------------
    // Scoring settings
    // ------------------------------------------------------------------------
    scoring: {
      // "absolute"  = matches the Excel model: sum of |student - ideal| across
      //               all skills ("Gross Dev"). Scoring above OR below the
      //               ideal both count against the match.
      // "shortfall" = experimental: only counts skills where the student is
      //               BELOW the ideal. Not used by the Excel model.
      deviationMethod: "absolute",

      topMatches: 5,
      bottomMatches: 5,
      topSkills: 3,

      // How ties in the Top Skills list are broken (see README):
      //  "surveyOrder"        = skill that comes first in the survey wins.
      //                         Reproduces the professor's emailed results.
      //  "topCareerRelevance" = skill that the student's top career matches
      //                         rely on most wins (then survey order).
      // Either way, skills left out by a tie are shown as "also tied".
      skillTieBreak: "surveyOrder"
    },

    // 1-5 answer scale (matches the Excel "Option 1" ... "Option 5")
    scale: [
      { value: 1, label: "Strongly disagree" },
      { value: 2, label: "Disagree" },
      { value: 3, label: "Neutral" },
      { value: 4, label: "Agree" },
      { value: 5, label: "Strongly agree" }
    ],

    questionsPerPage: 5,

    // ------------------------------------------------------------------------
    // "About you" questions (Blank Survey A3:A6)
    // Answer choices below are placeholders - confirm with the professor.
    // ------------------------------------------------------------------------
    profileQuestions: [
      { id: "name", label: "Enter your name", type: "text", required: true },
      {
        id: "status", label: "What is your current status in school?", type: "select", required: true,
        options: ["Freshman", "Sophomore", "Junior", "Senior", "Graduate student", "Other"]
      },
      {
        id: "majors", label: "What is your major or general field of study? Select all that apply.", type: "checkbox", required: true,
        options: ["Finance", "Accounting", "Economics", "Management", "Marketing", "Agribusiness", "Management Information Systems", "Other"]
      },
      {
        id: "minors", label: "List any minors, certificates or other emphasis you are pursuing or plan to pursue before graduation.",
        type: "textarea", required: false
      }
    ],

    // ------------------------------------------------------------------------
    // Skills - order matters: it is the column order of every career profile.
    // ------------------------------------------------------------------------
    skills: [
      { id: "selling",   name: "Selling / Relationship Management", short: "Rel Mgmt" },
      { id: "analysis",  name: "Analysis",                          short: "Analysis" },
      { id: "critical",  name: "Critical Thinking / Problem Solving", short: "Problem Solv" },
      { id: "written",   name: "Written Communication",             short: "Written Comm" },
      { id: "verbal",    name: "Verbal Communication",              short: "Verbal Comm" },
      { id: "org",       name: "Organization",                      short: "Organization" },
      { id: "teamwork",  name: "Teamwork",                          short: "Teamwork" },
      { id: "prof",      name: "Professionalism",                   short: "Professionalism" },
      { id: "time",      name: "Time Management",                   short: "Time Mgmt" },
      { id: "detail",    name: "Attention to Detail",               short: "Attn to Detail" }
    ],

    // ------------------------------------------------------------------------
    // Survey questions (Sheet2). `id` keeps the professor's codes (S-1, A-1...).
    // Students never see the codes or skill names while taking the survey.
    // A few spelling fixes from the workbook: statistics, conciseness, professional.
    // ------------------------------------------------------------------------
    questions: [
      { id: "S-1", skill: "selling", text: "In a group or 1-on-1, I am often able to convince others to agree with my preference or opinion." },
      { id: "S-2", skill: "selling", text: "I don't take it personally when someone disagrees with me or can't see my point of view." },
      { id: "S-3", skill: "selling", text: "I can usually tell when it's a good time to use humor, be serious, or be quiet in a conversation." },
      { id: "S-4", skill: "selling", text: "I am usually comfortable meeting new people, and I don't have a problem connecting with someone in a room full of strangers." },
      { id: "S-5", skill: "selling", text: "After meeting someone, I can usually recall their name or at least one important fact about them." },

      { id: "A-1", skill: "analysis", text: "When I face a complex issue, I can usually break it down into smaller problems and solve them one at a time." },
      { id: "A-2", skill: "analysis", text: "Making sure that all of the details are accurate is important to me in my work and at home." },
      { id: "A-3", skill: "analysis", text: "I feel more comfortable with a spreadsheet than I do working with customers." },
      { id: "A-4", skill: "analysis", text: "If something doesn't make sense to me, I will usually keep going until I understand it." },
      { id: "A-5", skill: "analysis", text: "The more a task involves math, statistics and calculations, the more I enjoy it." },

      { id: "CT-1", skill: "critical", text: "I am not bothered by a problem that has no clear solution." },
      { id: "CT-2", skill: "critical", text: "I can prioritize competing goals when making decisions." },
      { id: "CT-3", skill: "critical", text: "I am able to consider the consequences of different options when making decisions." },
      { id: "CT-4", skill: "critical", text: "I am comfortable navigating situations where there is no established precedent or process." },
      { id: "CT-5", skill: "critical", text: "I enjoy forward-looking tasks that require me to keep long-term goals in mind." },

      { id: "W-1", skill: "written", text: "My grammar and punctuation skills are strong." },
      { id: "W-2", skill: "written", text: "I can usually get my point across more effectively by writing than by speaking." },
      { id: "W-3", skill: "written", text: "In a group project, I often end up being the group member who does most of the writing." },
      { id: "W-4", skill: "written", text: "I enjoy finding just the right words and trying to maintain a consistent train of thought when completing a writing assignment." },
      { id: "W-5", skill: "written", text: "Even when writing emails and texts, I re-read my own words for clarity and conciseness." },

      { id: "OC-1", skill: "verbal", text: "I enjoy the challenge of speaking to a group of any size." },
      { id: "OC-2", skill: "verbal", text: "I can usually get my point across more effectively by speaking than by writing." },
      { id: "OC-3", skill: "verbal", text: "In a group project, I often end up being one of the team members who handles the speaking roles." },
      { id: "OC-4", skill: "verbal", text: "When communicating important information, I prefer a phone call or face-to-face meeting to an email or text." },
      { id: "OC-5", skill: "verbal", text: "I rarely struggle to find the right words when speaking to others in a professional setting." },

      { id: "Org-1", skill: "org", text: "I rarely miss a deadline or an important date." },
      { id: "Org-2", skill: "org", text: "I can manage conflicting priorities and budget my time appropriately." },
      { id: "Org-3", skill: "org", text: "I keep a written list of tasks rather than relying on my memory to make sure I get things done on time." },
      { id: "Org-4", skill: "org", text: "My friends and co-workers would likely say that I am reliable and follow through on my commitments." },
      { id: "Org-5", skill: "org", text: "On a vacation, I enjoy planning out my time to make sure I make the most of the experience." },

      { id: "T-1", skill: "teamwork", text: "I enjoy working on projects with others and finding my role in a group." },
      { id: "T-2", skill: "teamwork", text: "I am quick to identify the skills of others and help to make sure they are able to use them in the best ways possible." },
      { id: "T-3", skill: "teamwork", text: "The success of the team is more important than my individual accomplishments." },
      { id: "T-4", skill: "teamwork", text: "I appreciate having the opportunity to ask others for feedback on a tough situation and to provide feedback to them when asked." },
      { id: "T-5", skill: "teamwork", text: "I am rarely able to accomplish more on my own than in a group setting." },

      { id: "P-1", skill: "prof", text: "It is important to me that I maintain a professional relationship with my co-workers." },
      { id: "P-2", skill: "prof", text: "In stressful situations, I still manage to treat others with respect." },
      { id: "P-3", skill: "prof", text: "If I tell someone I will get back to them in a certain amount of time, I very rarely fail to honor this commitment." },
      { id: "P-4", skill: "prof", text: "If I need to be late for a meeting, I will always notify the other(s) of when I will arrive." },
      { id: "P-5", skill: "prof", text: "If I need to deliver bad news, I am able to be tactful and empathetic while sticking to the facts." },

      { id: "TM-1", skill: "time", text: "It is very rare that I am late for a meeting." },
      { id: "TM-2", skill: "time", text: "I will work longer hours to meet a deadline when necessary." },
      { id: "TM-3", skill: "time", text: "I can keep distractions to a minimum and stay on task." },
      { id: "TM-4", skill: "time", text: "I am able to delegate tasks when possible to use my time effectively." },
      { id: "TM-5", skill: "time", text: "I know which tasks I can do more effectively at different times of the day." },

      { id: "AD-1", skill: "detail", text: "I notice errors in written print or numerical tables and try to correct them when the errors are my own." },
      { id: "AD-2", skill: "detail", text: "I double-check my work when completing an assignment involving numbers and data." },
      { id: "AD-3", skill: "detail", text: "I pay close attention to instructions and make notes where necessary." },
      { id: "AD-4", skill: "detail", text: "I rarely take shortcuts and often look for the most complete way to finish a task." },
      { id: "AD-5", skill: "detail", text: "I am quick to correct a small error before it becomes a larger error." }
    ],

    // ------------------------------------------------------------------------
    // Career profiles (Scoring Template). Numbers are the ideal 1-5 rating in
    // the same order as `skills`:
    //   [RelMgmt, Analysis, ProbSolv, Written, Verbal, Org, Team, Prof, Time, Detail]
    //
    // `group`    = Front-Line / Back-Office, as in the workbook.
    // `category` = placeholder for the 2026 career categories
    //              (Risk & insurance, Credit & lending, Retirement & wealth mgmt,
    //               Real estate & valuation, Operations & compliance).
    //              Not used yet - fill in once the professor assigns them.
    // `description` = optional one-liner shown on the results page.
    // ------------------------------------------------------------------------
    careerGroups: ["Front-Line", "Back-Office"],
    careerCategories: [], // TODO(2026): e.g. ["Risk & insurance", "Credit & lending", ...]

    careers: [
      { name: "Business Banker",            group: "Front-Line",  category: null, profile: [5, 3, 4, 3, 5, 3, 4, 5, 4, 3] },
      { name: "Personal / Retail Banker",   group: "Front-Line",  category: null, profile: [5, 2, 2, 2, 4, 3, 4, 4, 3, 2] },
      { name: "Mortgage Lender",            group: "Front-Line",  category: null, profile: [5, 2, 3, 3, 5, 3, 4, 4, 4, 3] },
      // NOTE(2026): professor wants to tighten Cash Management so it doesn't land in everyone's top 5.
      { name: "Cash Management",            group: "Front-Line",  category: null, profile: [4, 3, 3, 3, 4, 4, 4, 5, 4, 4] },
      { name: "Insurance Agent",            group: "Front-Line",  category: null, profile: [5, 2, 3, 2, 5, 4, 4, 4, 4, 3] },
      { name: "Investment Representative",  group: "Front-Line",  category: null, profile: [5, 3, 4, 2, 5, 4, 4, 4, 4, 4] },
      { name: "Wealth Management",          group: "Front-Line",  category: null, profile: [5, 3, 4, 3, 5, 4, 4, 4, 4, 4] },
      { name: "Customer Care",              group: "Front-Line",  category: null, profile: [4, 1, 2, 2, 4, 3, 3, 3, 3, 2] },

      { name: "Credit Analyst",             group: "Back-Office", category: null, profile: [2, 4, 4, 4, 3, 4, 3, 4, 4, 5] },
      { name: "Risk Management",            group: "Back-Office", category: null, profile: [1, 5, 5, 4, 4, 4, 4, 4, 4, 4] },
      { name: "Fraud",                      group: "Back-Office", category: null, profile: [1, 5, 5, 4, 3, 4, 3, 4, 4, 5] },
      { name: "Compliance",                 group: "Back-Office", category: null, profile: [1, 4, 4, 4, 3, 3, 3, 3, 3, 4] },
      { name: "Mortgage Underwriter",       group: "Back-Office", category: null, profile: [2, 4, 4, 4, 2, 4, 3, 3, 4, 5] },
      { name: "Insurance Underwriter",      group: "Back-Office", category: null, profile: [1, 4, 4, 4, 3, 4, 3, 3, 4, 5] },
      { name: "Loan Documentation",         group: "Back-Office", category: null, profile: [1, 1, 2, 3, 3, 3, 3, 3, 4, 5] },
      { name: "Loan Operations",            group: "Back-Office", category: null, profile: [1, 3, 3, 4, 2, 4, 2, 3, 3, 4] },
      { name: "Deposit Operations",         group: "Back-Office", category: null, profile: [1, 3, 3, 4, 2, 4, 2, 3, 3, 4] },
      { name: "Marketing Analyst",          group: "Back-Office", category: null, profile: [3, 2, 3, 3, 3, 3, 3, 3, 3, 3] },
      { name: "Technology / Info Security", group: "Back-Office", category: null, profile: [1, 4, 4, 3, 2, 4, 2, 3, 4, 4] },
      { name: "Data Analytics",             group: "Back-Office", category: null, profile: [1, 5, 4, 4, 2, 4, 3, 3, 4, 5] },
      { name: "Mortgage Operations",        group: "Back-Office", category: null, profile: [1, 3, 3, 3, 2, 3, 3, 3, 4, 4] },
      { name: "Bank Examiner",              group: "Back-Office", category: null, profile: [1, 4, 4, 4, 4, 4, 5, 4, 3, 4] },
      { name: "Auditor",                    group: "Back-Office", category: null, profile: [1, 4, 5, 4, 3, 4, 3, 4, 4, 5] },
      { name: "Loan Review",                group: "Back-Office", category: null, profile: [1, 5, 3, 4, 3, 4, 3, 3, 3, 5] },
      { name: "Financial Analyst",          group: "Back-Office", category: null, profile: [1, 5, 4, 4, 3, 4, 2, 3, 3, 5] },
      { name: "Human Resources",            group: "Back-Office", category: null, profile: [2, 2, 3, 3, 4, 3, 4, 5, 4, 4] },
      { name: "Physical Security",          group: "Back-Office", category: null, profile: [1, 3, 3, 4, 3, 4, 3, 4, 3, 4] }
      // TODO(2026): Investment Banker? AI Analyst? Additional tech / HR / sales paths.
    ],

    // ------------------------------------------------------------------------
    // Text shown on the results page (adapted from the professor's email).
    // ------------------------------------------------------------------------
    resultsIntro:
      "Take this as food for thought. The model isn't perfect, but it's a place to start in mapping a set of " +
      "skills and preferences against different banking jobs that normally require more (or less) of certain " +
      "things, and seeing where you fall. The deviation score shows how closely you match the \"ideal\" " +
      "characteristics for each career path as outlined with input from banking professionals. Lower means a closer match.",
    contactLine: "Questions or feedback? Contact the NDSU Center for Banking and Finance."
  };

  if (typeof module !== "undefined" && module.exports) module.exports = SURVEY_CONFIG;
  else root.SURVEY_CONFIG = SURVEY_CONFIG;
})(this);
