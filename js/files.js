function _get_page_about_general() {
  return `
Infra/backend software engineer with 3 years of full-time work experience. You're currently looking at the sum total of my frontend experience.

Hobbies include learning new languages, dance and martial arts, reading about philosophy and history, and playing Genshin, Honkai Star Rail, and Zenless Zone Zero.
`;
}

function _get_page_career_and_education() {
  return `
# Work Experience
**[Acrocyte Therapeutics](https://www.acrocyte.com/)** __Software engineer & data analyst__

**[Brex](https://www.brex.com/)** __Software engineer, Observability and Release engineer teams__

# Education
**California Institute of Technology** __Bachelor of science, Computer science__
  `;
}

function _get_page_skills() {
 return `
# Languages
* English - Native
* Mandarin Chinese - Intermediate/Advanced (Acrocyte uses a combo of Chinese and English)
* Hokkien Taiwanese - Intermediate (Spoken at home)
* Japanese - Intermediate (Conversational, can read novels, not business-level)
* Spanish, French, German, Arabic, Hindi, Indonesian, Cantonese, Korean, Polish - Beginner

# Programming languages, etc.
Python (scipy, torch, tensorflow, pandas, numpy), golang, C++, C, git, Unix
Some Haskell, OCaml, R, Java, SQL, Swift, Mathematica, Fortran, BASIC, Ruby, LaTeX 
  `;
}

function _get_page_todo() {
  return `
Oops, looks like I haven't written this page yet. Come back later!
  `
}

var fileSystem = {
  "about": {
    "general": _get_page_about_general,
    "career_and_education": null,
    "skills": null,
    "projects": null,
  },
  "misc": {
    "book_recs": null,
    "submit_book_recs": null,
  },
  "contact": null
};
