# MarcelinaExpress

A Polish-language English vocabulary flashcard app: photo import of word lists,
manual "trudne" (hard) marking, an adaptive difficulty system, and two study
modes (tap-to-reveal and type-the-answer). Words are saved in the browser
(`localStorage`) — no backend/database needed.

## Fastest path: deploy in ~5 minutes (no coding required)

You need a free [GitHub](https://github.com) account and a free
[Vercel](https://vercel.com) or [Netlify](https://netlify.com) account.

1. **Create a new GitHub repo** and upload every file in this folder to it
   (GitHub's web UI has an "Add file → Upload files" button — drag the whole
   folder in).
2. **Go to [vercel.com/new](https://vercel.com/new)**, sign in with GitHub,
   and import that repo. Vercel auto-detects it's a Vite project — just
   click **Deploy**. No settings to change.
3. After a minute you'll get a live URL like `marcelina-express.vercel.app`.
   That's it — the app is published.
4. Open that URL on her phone, tap the browser's **Share → Add to Home
   Screen** (iPhone) or the **Install** prompt (Android/Chrome), and it'll
   sit on the home screen with its own icon, opening full-screen like a
   normal app.

Netlify works the same way (`netlify.com` → "Add new site → Import an
existing project").

## Running it locally first (optional)

If you have [Node.js](https://nodejs.org) installed:

```bash
npm install
npm run dev
```

This opens the app at `http://localhost:5173`. To build the static files
Vercel/Netlify serve in production:

```bash
npm run build
```

## About the photo-import feature

Turning a photo into flashcards uses Claude's vision model, called directly
from the browser. Since this app runs on your own domain (not inside
Claude's product), it needs its own **Anthropic API key**:

1. Open the app → tap the gear icon (top right) → **Ustawienia**.
2. Generate a key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   (Anthropic gives new accounts some free credits; after that it's pay-as-you-go —
   each photo scan costs a fraction of a cent).
3. Paste the key in and save.

The key is stored only in that browser's `localStorage`, and photos are sent
directly from the browser to Anthropic's API — nothing passes through a
server of yours. Because the key lives in the browser, don't use this setup
for a public multi-user product; it's fine for a personal app used by you
and your girlfriend on your own devices.

If you'd rather skip API keys entirely, the **manual add** tab always works
with no setup — just type words in.

## What's inside

- `src/App.jsx` — the whole app
- `vite.config.js` — includes `vite-plugin-pwa` so it installs as a proper
  home-screen app with an offline-capable shell
- `public/icon-*.png` — app icons already generated for you
