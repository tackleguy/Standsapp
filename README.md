# Stands

A free, social, second-screen sports app. Fans open Stands while a game, race, or
match is on to follow the score and play-by-play, rate big moments, chat, make
free-points predictions, collect cards, and join friend groups.

Right now Stands runs as a **web app** (open it in Safari on an iPhone). The same
code will later become the iPhone and Android apps.

## How it is built

- **Expo + React Native + TypeScript**: one codebase for web, iPhone and Android.
- **expo-router**: every file in `src/app/` is a screen.
- **Vercel**: hosts the web version. Every push to GitHub redeploys it automatically.
- **Data**: built-in demo data for now. A database will be added later.

## Folders

| Path | What is in it |
| --- | --- |
| `src/app/` | Screens. `index.tsx` is the first screen. |
| `src/config/sports.ts` | The list of every sport Stands supports (single source of truth). |
| `src/theme/tokens.ts` | Colors, spacing and text styles ("floodlights at night"). |
| `public/` | Files served as-is on the web (page template, home-screen icon). |
| `assets/images/` | App icon, favicon and splash image. |
| `vercel.json` | Tells Vercel how to build and serve the web app. |
| `PROGRESS.md` | What works, what is next, and which accounts are set up. |

## Running it on a computer (optional)

You need [Node.js](https://nodejs.org) installed. Then, in this folder:

```bash
npm install
```

```bash
npm run web
```

That opens Stands in your browser and reloads it as files change.

## Checks

```bash
npm run check
```

Runs the linter (style and mistakes) and the type checker. Both must pass before
a phase is called done.

## Building the web version

```bash
npm run build:web
```

This writes the finished website into `dist/`. Vercel runs this same command.
