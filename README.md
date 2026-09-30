# EduGenie

EduGenie is a browser-based study desk for asking questions, understanding new ideas, practicing with a quiz, and making a study plan. Its tutor is powered by Google Gemini.

## Development environment

Requires Node.js 20.19+ or 22.12+ and npm. Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Vite prints the local URL (usually `http://localhost:5173`). For a production build, run `npm run build`; preview it locally with `npm run preview`. An internet connection is needed for Google Fonts, the welcome image, and Gemini responses.

## Connect Gemini

1. Open **Settings** in EduGenie.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey), then paste it into the connection dialog.
3. Start a learning session.

The key is saved in the browser's local storage and sent directly to Google's Gemini API when a message is submitted. This lightweight local app has no server to protect a key: use it only on a trusted, private device, and do not embed an unrestricted key in a public deployment. Remove the key in Settings when finished. Gemini API usage is subject to Google's availability, terms, and any applicable charges.

## What is included

- Tutor, Explain simply, Quiz me, and Study plan modes
- Subject-aware prompts for mathematics, science, writing, languages, and history
- Saved conversations in browser storage
- Responsive layout for desktop and mobile
- Keyboard-friendly chat, visible connection state, and friendly API error messages

AI responses can be inaccurate. Verify important information with a trusted source.