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
- Checks at the time: `npm run check` (linter + type checker + 41 tests) passed.

## Version 2: "make it feel real" (November 2026)

- **Look**: Barlow Condensed for scores, clocks and headings; every club has kit colours, drivers
  wear their team's livery, solo athletes their nation's colours; leagues have realistic invented
  names (Premier Football League, Grand Prix World Series...). The per-card DEMO tags are gone;
  one honest note stays at the bottom of Today and in Settings.
- **Today**: live scores ticker, swipeable featured big games with team-colour glow, score cards
  with season records, the live crowd and the latest key play.
- **Fixtures**: round-robin (circle method), so no team is ever in two games at once (tested).
- **Season**: league tables with form, movement and qualification zones; win-loss standings;
  driver and team championships; fighter rankings; head-to-head. Team and athlete pages show
  position, record, form, streak and a mini table.
- **Live game screen**: team-colour scoreboard with a ticking clock, scorers, red cards and
  "N watching"; live win probability (bar and chart, never 100% before the end); a Preview tab
  before kick-off (countdown, form, table, head-to-head, crowd pick); celebration banners for
  big moments; denser play-by-play with icons; in-app alerts for followed teams and open Calls.
- **Live chat**: a packed match thread that reacts to the real plays (scorers, score, clock),
  supporters in team colours, replies, typing indicator, floating reactions, big-moment cards.
- **Leaderboards**: Today / Week / Season, global, following or by sport, ~50K ranked fans with
  estimated ranks, podium, movement arrows, tiers (Bronze to Legend, reset every Monday),
  "around you", a pinned You bar, and fan profiles with Calls settled on real simulated results.
- **Calls, Cards, Sections, Search, Welcome**: crowd pick split on every Call; trading-card art
  for Stand Cards; Sections show latest message and who is online; Search shows trending teams;
  the welcome screen shows what is live right now.
- **Honesty note**: other fans, chat and the crowd are simulated. Before inviting real people,
  either connect the database (so the people are real) or label the simulated ones again.

## Stand Cards update (November 2026)

- **Pack Store** with five pack types, each with published odds: Daily Free Pack (1 card, once a
  day), Standard (3 cards, 25 Tix), Premium (5 cards, 75 Tix, last card Rare or better), Elite
  (3 cards, 150 Tix, no Commons, last card Epic or better), and **Game Packs** (2 cards, 20 Tix).
- **Game Packs** are sold per game, from 2 hours before the start until it ends, and only hold
  cards of that game's teams or athletes. Game Day cards get a red stamp with the date and their
  own print run, pay double Tix if their side wins that game, and get a WON stamp. A banner on
  the game's Feed opens it.
- **Holo parallels** (1 in 10 cards) with a foil shine, and **numbered print runs** (for example
#003/25). Sold-out runs are never oversold.
- **Quick sell** any card for Tix (Common 1, Rare 3, Epic 10, Legendary 40, Holo double), one at a
  time or "sell all duplicates", including straight after opening a pack.
- **Card page**: flip the card to see its back (home, league, form, next game, set number),
  favorite it (protects it from selling), pin it to the 5-card **showcase** on Me, see every copy.
- **Collection**: duplicates stack (x3), sort (newest, rarest, lowest serial, name, value),
  filters (sport, rarity, favorites, Holo, Game Day, duplicates), Cards / Unique / Score tiles.
- **Trade up**: 5 cards of one rarity become 1 card of the next rarity (same sport if all 5 are).
- **Sets**: one per sport, shown as an album with empty slots. Collect every team or athlete to
  claim 10 Tix per card in the set.
- NEW / DUPLICATE tags and a glow for Epic and Legendary pulls when packs open.
- Win bonuses only count games that finish after you got the card; team cards (an F1
  constructor) also pay when one of their athletes wins.
- Saved data moved to version 2 without losing any cards.
- Checks: `npm run check` (linter + type checker + 108 tests) passes.

## What is next

1. Connect the GitHub repo to Vercel so the app has a web address for the iPhone.
2. Choose and connect the database (shared accounts, real chat between phones, real Sections).
3. Real data feeds, one sport at a time (Formula 1 first), replacing demo data.

## Accounts and keys (names only, never values)

- GitHub repo: `krichman2000/Standsapp`, connected. Version 1 lives on branch `claude/great-lamport-4twc5u` (the repo's default branch); version 2 is on `claude/inspiring-cannon-8mk1i0`.
- Supabase: an account is connected to Claude but **not used**. Decision: no database for now.
- Vercel: to be connected.
