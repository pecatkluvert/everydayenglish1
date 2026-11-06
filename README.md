# Everyday English — Lesson 1

A complete English practice app for GitHub Pages. Uses HTML, CSS, vanilla JavaScript, and JSON. No npm install, framework, API key, account, or server backend is needed.

## Open it now

Extract the ZIP, keep the folder structure intact, and double-click `index.html`. The included `data/lessons.bundle.js` allows local use without a web server. On GitHub Pages, the app reads the JSON files directly.

Optional local server (Python 3):

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Run the command from the folder containing `index.html`.

## Publish on GitHub Pages

1. Create a GitHub repository (a public repository works with GitHub Free).
2. Upload the **contents** of `english-practice`, including the `data`, `assets`, and `scripts` folders, into the repository root. `index.html` must be at the root. Include `.nojekyll` if your upload method shows dotfiles; the app also works without it.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select **main** and **/ (root)**, then click **Save**.
6. Wait for GitHub's deployment to complete. Open the URL shown under Pages, usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

All asset and JSON URLs are relative, so both repository Pages and username Pages work. No Actions workflow or build command is required. Keep filename capitalization exactly as supplied.

## What is included

- All ten Lesson 1 expressions, with definitions, two example sentences, and a short example dialogue for each.
- All ten original multiple-choice questions, with the original option order.
- The complete restaurant dialogue and all six original blanks, with its word bank.
- The complete “Idioms in Context” story and clickable expression meanings.
- Check-answer feedback, explanations, a question navigator, score review, and retrying mistakes.
- Hide/reveal meanings for recall practice and an “I know this expression” checklist.
- Optional pronunciation using your browser's speech synthesis, when available. Voice availability depends on the device; some voices may need an Internet connection.
- Progress saved locally per lesson, responsive layouts, keyboard controls, and a confirmation before resetting progress.

The supplied PDF contains Lesson 1 only (six PDF pages). There are no extra reading-comprehension questions in that source. The story is included as a reading activity. No new questions are presented as original book exercises.

## Files

```text
index.html                  App entry point
styles.css                  Responsive design
app.js                      Rendering, answer checking, routing, and local progress
.nojekyll                   Simple static hosting on GitHub Pages
assets/favicon.svg          App icon
data/lessons.json           Catalog: which lessons appear in the picker
data/lesson-01.json         All Lesson 1 content, questions, answers, and explanations
data/lesson-template.json   A valid small example for creating the next lesson
data/lessons.bundle.js      Generated local-file fallback (do not edit by hand)
scripts/validate.py         Standard-library content validation
scripts/package.py          Validate, update offline bundle, and create a source ZIP
README.md                   This guide
ANSWER-KEY.md               Quick teacher/reference answer key
CHECKS.md                   Verification scope and limitations
```

## Add Lesson 2 to this app

1. Copy `data/lesson-template.json` to `data/lesson-02.json`.
2. Change its `id`, `number`, `title`, `subtitle`, and content. Replace all example content with your own lesson. Keep every expression/question/dialogue ID unique within that lesson.
3. Add this entry to the `lessons` array in `data/lessons.json`, keeping the Lesson 1 entry:

```json
{
  "id": "lesson-02",
  "file": "data/lesson-02.json",
  "number": 2,
  "title": "Your lesson title"
}
```

The catalog title and number must match the lesson JSON. Use commas between entries; JSON does not allow trailing commas or comments.

4. From the app folder, run:

```sh
python scripts/package.py
```

This validates the content, refreshes the offline bundle, and writes `everyday-english.zip` next to the app folder. Python is only needed for this maintenance command, never for hosting or using the app.

5. Upload the changed JSON files, catalog, and refreshed bundle to GitHub. The lesson picker updates automatically.

A direct lesson link is `index.html#lesson=lesson-02&section=overview`. Available section values: `overview`, `learn`, `practice`, `dialogue`, `story`.

## Make a separate app/repository for each lesson

Copy this entire app folder. Replace the catalog's `lessons` array with **only** the new lesson entry. Keep that lesson's JSON, the template, and the app files. Remove the old lesson JSON if you no longer need it. Run `python scripts/package.py`, then upload to a new GitHub repository using the steps above. No JavaScript changes are needed.

## JSON content rules

Use the template as a working example. Each lesson needs all four sections.

- `schemaVersion`: currently `1`.
- `id`: a stable lesson ID such as `lesson-02`; it must match the catalog.
- `contentVersion`: positive integer. Increase it after substantially changing questions or answers, so old progress does not apply to new content.
- `expressions`: each entry has an `id`, `phrase`, `meaning`, `examples` array, and `dialogue` array.
- `practice.questions`: each has a stable `id`, `prompt` with one `____`, `options` array, `answer` matching one option exactly, `expressionId`, and `explanation`.
- `dialogue.wordBank`: all answers, once each. Each dialogue line has `id`, `speaker`, and `text`. A line with a blank also needs `answer`, `expressionId`, and `explanation`.
- `story.paragraphs`: an array of plain-text paragraphs. `story.highlights` maps an exact text fragment to an `expressionId`. Match the story's capitalization.
- Content is treated as plain text. Do not put HTML into JSON fields.

The multiple-choice answer is selected by its text, never by its display letter. Dialogue checking ignores capitalization, surrounding/extra spaces, and final `. ! ? ,` punctuation. It otherwise requires the word-bank phrase. Scores are based on the current attempt. Retrying mistakes preserves correct answers and clears incorrect/unanswered questions. Previously checked answers and scores remain visible until retried or reset.

## Progress and privacy

Progress is stored in this browser's `localStorage`, keyed by lesson ID and content version. It does not sync across devices, browser profiles, or site origins. Different GitHub repositories under the same origin share storage, so give unrelated courses distinct lesson IDs. Clearing browser data removes progress. If browser storage is unavailable, the app still runs for the current visit.

This is a self-study app: answer keys are intentionally downloadable and inspectable. It is not a secure exam platform. The app itself makes no analytics or tracking requests and uses no external fonts or scripts.

## Source and editorial notes

Based on the user-supplied `1 Illustrated_Everyday_Expressions_with_Stories_2.pdf`. The source supplies no published answer key; answers were inferred from the lesson definitions and exercise context. Explanations were added for this app. Obvious OCR errors and line-break hyphenation were corrected after checking the exercise images. The story's final dialogue is split into separate paragraphs for readability. Source cartoons and unrelated footer text are not reproduced; the interface uses an original workbook illustration.
