# Stands: Progress Log

## Decisions so far

- **Web app first.** Testing happens in Safari on an iPhone. Native iPhone/Android
  apps come later from the same code (Expo).
- **Hosting: Vercel.** The site is built with `npm run build:web` and served from `dist/`.
- **No database yet.** The app will run on built-in demo data. The database will
  be set up later through Vercel. Features that need accounts (chat, predictions,
  cards) will be placeholders until then.
- Stack: Expo SDK 58, expo-router (screens live in `src/app/`), TypeScript strict mode.

## What works

- Phase 0: the project runs and shows a dark "Stands" screen with the tagline and
  the five launch sports. Builds for web without errors. Linter and type checker pass.
- Original placeholder icon (amber "S" on night blue) for the browser tab and the
  iPhone home screen. All Expo template artwork has been removed.

## What is next

1. Answer: which three sports should look best first? (Default: Formula 1, cricket, rugby union.)
2. Connect this GitHub repo to Vercel so the app has a web address to open on the iPhone.
3. Phase 2 (adjusted for no database): demo feed + Today screen with scores for five sports.

## Accounts and keys (names only, never values)

- GitHub repo: `krichman2000/Standsapp`
- Supabase: an existing account is connected to Claude, but **not used**. Decision: no database for now.
- Vercel: to be connected.
