// How the demo world schedules each sport. Times are in UTC hours.
// Wave 1 sports run on a rolling timetable so something is always live.

export type EngineId = 'h2h' | 'cricket' | 'race' | 'golf' | 'cycling' | 'tennis' | 'combat' | 'baseball';

export type Roster =
  | { kind: 'teams'; count: number }
  | { kind: 'athletes'; count: number; teams?: 'racing' | 'cycling'; perTeam?: number };

export type Slots =
  | { kind: 'rolling'; everyMin: number; offsetMin: number }
  | { kind: 'daily'; hours: number[] };

export interface SportPlan {
  sportId: string;
  engine: EngineId;
  roster: Roster;
  competitions: { name: string; short: string }[];
  /** Typical real-world length, used for timetables and "starting soon". */
  durationMin: number;
  slots: Slots;
}

export const PLANS: SportPlan[] = [
  // ---- Wave 1 ----
  { sportId: 'f1', engine: 'race', roster: { kind: 'athletes', count: 20, teams: 'racing', perTeam: 2 },
    competitions: [{ name: 'Demo Grand Prix Series', short: 'DGP' }],
    durationMin: 95, slots: { kind: 'rolling', everyMin: 150, offsetMin: 20 } },
  { sportId: 'cricket', engine: 'cricket', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Demo T20 League', short: 'T20' }, { name: 'Demo T20 Cup', short: 'CUP' }],
    durationMin: 185, slots: { kind: 'rolling', everyMin: 105, offsetMin: 0 } },
  { sportId: 'rugby_union', engine: 'h2h', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Demo Premiership XV', short: 'PXV' }, { name: 'Demo Nations Cup', short: 'DNC' }],
    durationMin: 105, slots: { kind: 'rolling', everyMin: 75, offsetMin: 10 } },
  { sportId: 'soccer', engine: 'h2h', roster: { kind: 'teams', count: 20 },
    competitions: [{ name: 'Demo Premier Division', short: 'DPD' }, { name: 'Demo Continental Cup', short: 'DCC' }],
    durationMin: 112, slots: { kind: 'rolling', everyMin: 55, offsetMin: 5 } },
  { sportId: 'basketball', engine: 'h2h', roster: { kind: 'teams', count: 16 },
    competitions: [{ name: 'Demo Pro League', short: 'DPL' }, { name: 'Demo Collegiate', short: 'COL' }],
    durationMin: 135, slots: { kind: 'rolling', everyMin: 80, offsetMin: 30 } },

  // ---- Wave 2 ----
  { sportId: 'rugby_league', engine: 'h2h', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Demo League XIII', short: 'L13' }],
    durationMin: 100, slots: { kind: 'daily', hours: [7, 9.5, 11, 18, 20.5] } },
  { sportId: 'american_football', engine: 'h2h', roster: { kind: 'teams', count: 16 },
    competitions: [{ name: 'Demo Gridiron League', short: 'DGL' }],
    durationMin: 200, slots: { kind: 'daily', hours: [0.5, 17, 20.5, 23.5] } },
  { sportId: 'baseball', engine: 'baseball', roster: { kind: 'teams', count: 14 },
    competitions: [{ name: 'Demo Ball League', short: 'DBL' }],
    durationMin: 180, slots: { kind: 'daily', hours: [1.5, 16, 17.5, 19, 23] } },
  { sportId: 'ice_hockey', engine: 'h2h', roster: { kind: 'teams', count: 14 },
    competitions: [{ name: 'Demo Ice League', short: 'DIL' }],
    durationMin: 150, slots: { kind: 'daily', hours: [0, 1, 2.5, 18.5, 23] } },
  { sportId: 'aussie_rules', engine: 'h2h', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Demo Footy League', short: 'DFL' }],
    durationMin: 140, slots: { kind: 'daily', hours: [3, 5.5, 8.5, 9.5] } },
  { sportId: 'tennis', engine: 'tennis', roster: { kind: 'athletes', count: 32 },
    competitions: [{ name: 'Demo Open', short: 'OPN' }, { name: 'Demo Masters', short: 'MST' }],
    durationMin: 110, slots: { kind: 'rolling', everyMin: 70, offsetMin: 15 } },

  // ---- Wave 3 ----
  { sportId: 'golf', engine: 'golf', roster: { kind: 'athletes', count: 36 },
    competitions: [{ name: 'Demo Golf Tour', short: 'DGT' }],
    durationMin: 300, slots: { kind: 'daily', hours: [13] } },
  { sportId: 'motogp', engine: 'race', roster: { kind: 'athletes', count: 22, teams: 'racing', perTeam: 2 },
    competitions: [{ name: 'Demo Moto Championship', short: 'DMC' }],
    durationMin: 42, slots: { kind: 'daily', hours: [12, 15] } },
  { sportId: 'indycar', engine: 'race', roster: { kind: 'athletes', count: 20, teams: 'racing', perTeam: 2 },
    competitions: [{ name: 'Demo Open-Wheel Series', short: 'DOW' }],
    durationMin: 110, slots: { kind: 'daily', hours: [18, 21.5] } },
  { sportId: 'mma', engine: 'combat', roster: { kind: 'athletes', count: 24 },
    competitions: [{ name: 'Demo Fight League', short: 'DFL' }],
    durationMin: 20, slots: { kind: 'daily', hours: [1, 1.5, 2, 2.5, 3, 3.5, 20, 20.5, 21] } },
  { sportId: 'boxing', engine: 'combat', roster: { kind: 'athletes', count: 16 },
    competitions: [{ name: 'Demo Title Fights', short: 'DTF' }],
    durationMin: 42, slots: { kind: 'daily', hours: [21, 22, 23] } },
  { sportId: 'cycling', engine: 'cycling', roster: { kind: 'athletes', count: 30, teams: 'cycling', perTeam: 5 },
    competitions: [{ name: 'Demo Grand Tour', short: 'DGT' }],
    durationMin: 270, slots: { kind: 'daily', hours: [11] } },
  { sportId: 'netball', engine: 'h2h', roster: { kind: 'teams', count: 8 },
    competitions: [{ name: 'Demo Netball League', short: 'DNL' }],
    durationMin: 80, slots: { kind: 'daily', hours: [6, 8, 10, 19] } },
];

export const planFor = (sportId: string): SportPlan | undefined => PLANS.find((p) => p.sportId === sportId);
