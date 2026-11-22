# Stands: Progress Log

## Decisions so far

- **Web app first.** Testing happens in Safari on an iPhone ("Add to Home Screen" opens it full-screen).
  Native iPhone/Android apps come later from the same code (Expo).
- **Hosting: Vercel.** Vercel runs `npm run build:web` and serves `dist/`.
- **No database yet.** Everything runs on a built-in demo world. Your own activity (Clout, Tix,
  Calls, cards, messages, Sections, follows) is saved on the device. The database will be set up
  later through Vercel; check with Claude before choosing a provider there, because sign-in and
  live chat depend on it.
- Stack: Expo SDK 58, expo-router (screens in `src/app/`), TypeScript strict, React Query,
  zustand, FlashList, react-native-svg, jest.

## What works (version 1, demo data)

- **Live sports, all 18 sports**: Formula 1, cricket, rugby union, soccer, basketball, rugby
  league, American football, baseball, hockey, Aussie rules, tennis, golf, MotoGP, IndyCar, MMA,
  boxing, cycling, netball. Each has its own simulator that plays out events in real time
  (scores, clocks, play-by-play, stats), the same on every phone. Wave 1 sports run on a rolling
  timetable so something is always live.
- **Today**: day picker, sport switcher with live counts, "live only" toggle, Live / Starting soon /
  Later today / Final, followed teams float to the top, scores flash when they change.
- **Event screen**: sticky scoreboard; Feed (rate every play 1-10), Chat, Calls, Stats (box scores,
  line scores, cricket scorecards, race classifications, golf leaderboards, judges' cards).
- **Live track map for motorsport** (F1, MotoGP, IndyCar): original circuit drawings, every car as
  a numbered team-colour dot moving in real time from its lap times, safety car, pit stops,
  retirements, live timing tower, tap to track a driver.
- **Calls**: winner, totals, first score, method of victory, podium, safety car, breakaway, plus
  in-play calls with live odds. Stakes 10-500, payouts and refunds settle automatically.
- **Stand Cards**: 25-Tix packs of 3 with published odds (70/22/7/1), flip reveal, collection with
  filters, serial numbers, Tix bonuses when your cards' teams win.
- **Sections**: create, join by code, public demo Sections with chat and weekly leaderboard.
- **Gate Check** daily bonus with streaks; **weekly leaderboard**; **search**; **profile**.
- **Safety**: guest browsing, account needed to chat/predict/collect, 13+ age check, word filter,
  report, block, 2-second post throttle, delete account, privacy policy and community rules.
- Checks: `npm run check` (linter + type checker + 41 tests) passes.

## What is next

1. Connect the GitHub repo to Vercel so the app has a web address for the iPhone.
2. Choose and connect the database (shared accounts, real chat between phones, real Sections).
3. Real data feeds, one sport at a time (Formula 1 first), replacing demo data.

## Accounts and keys (names only, never values)

- GitHub repo: `krichman2000/Standsapp`, connected. Code lives on branch `claude/great-lamport-4twc5u` (the repo's default branch).
- Supabase: an account is connected to Claude but **not used**. Decision: no database for now.
- Vercel: to be connected.
