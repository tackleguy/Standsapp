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
- **Data**: a built-in simulated world (a "preview season"). Every sport has a simulator that
  plays events out in real time, identically on every phone, plus a season model (tables,
  records, championships), a crowd model (who is watching), a live chat engine and leaderboards.
  A database and real feeds will be added later.

## Folders

| Path | What is in it |
| --- | --- |
| `src/app/` | Screens. `(tabs)/index.tsx` is Today; `event/[id].tsx` is the live event screen; `standings/[sportId].tsx` is the league table; `fan/[id].tsx` is a fan's profile; `pack.tsx` is the Pack Store; `card/[id].tsx`, `set/[id].tsx` and `tradeup.tsx` are the card screens. |
| `src/components/` | Building blocks: score cards, play rows, Calls, chat, Stand Cards, the track map, tables, leaderboard rows. |
| `src/data/api.ts` | The one place screens get sports data from (swap point for a real backend). |
| `src/data/demo/` | The simulated world: teams and kit colours, fixtures, simulators for every sport, the season (`season.ts`), the crowd (`crowd.ts`), chat (`chat.ts`), leaderboards (`ranking.ts`), simulated fans. |
| `src/logic/` | Game rules: Calls, Gate Check, pack types and odds, card collection rules (quick sell, trade-up, sets), accounts, win probability (mirrors the planned server routines). |
| `src/store/` | What is saved on the device: wallet, Calls, cards, messages, Sections, settings. |
| `src/lib/tracks.ts` | Original circuit layouts for the live motorsport track map. |
| `src/config/sports.ts` | The list of every sport Stands supports (single source of truth). |
| `src/theme/tokens.ts` | Colors, spacing, fonts and text styles ("floodlights at night"). Scores and headings use the Barlow Condensed font. |
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

Runs the linter (style and mistakes), the type checker and the tests. All must pass
before a phase is called done.

## Building the web version

```bash
npm run build:web
```

This writes the finished website into `dist/`. Vercel runs this same command.
