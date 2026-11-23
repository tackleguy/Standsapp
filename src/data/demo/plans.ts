// How the demo world schedules each sport. Times are in UTC hours.
// Wave 1 sports run on a rolling timetable so something is always live.

export type EngineId = 'h2h' | 'football' | 'cricket' | 'race' | 'golf' | 'cycling' | 'tennis' | 'combat' | 'baseball';

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
    competitions: [{ name: 'Grand Prix World Series', short: 'GPW' }],
    durationMin: 95, slots: { kind: 'rolling', everyMin: 150, offsetMin: 20 } },
  { sportId: 'cricket', engine: 'cricket', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Super Twenty League', short: 'STL' }, { name: 'T20 Champions Cup', short: 'TCC' }],
    durationMin: 185, slots: { kind: 'rolling', everyMin: 105, offsetMin: 0 } },
  { sportId: 'rugby_union', engine: 'h2h', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Pro XV Championship', short: 'PXV' }, { name: 'Atlantic Union Cup', short: 'AUC' }],
    durationMin: 105, slots: { kind: 'rolling', everyMin: 75, offsetMin: 10 } },
  { sportId: 'soccer', engine: 'h2h', roster: { kind: 'teams', count: 20 },
    competitions: [{ name: 'Premier Football League', short: 'PFL' }, { name: 'Continental Champions Cup', short: 'CCC' }],
    durationMin: 112, slots: { kind: 'rolling', everyMin: 55, offsetMin: 5 } },
  { sportId: 'basketball', engine: 'h2h', roster: { kind: 'teams', count: 16 },
    competitions: [{ name: 'Pro Hoops League', short: 'PHL' }, { name: 'Collegiate Classic', short: 'CCL' }],
    durationMin: 135, slots: { kind: 'rolling', everyMin: 80, offsetMin: 30 } },

  // ---- Wave 2 ----
  { sportId: 'rugby_league', engine: 'h2h', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Super XIII League', short: 'S13' }],
    durationMin: 100, slots: { kind: 'daily', hours: [7, 9.5, 11, 18, 20.5] } },
  { sportId: 'american_football', engine: 'football', roster: { kind: 'teams', count: 16 },
    competitions: [{ name: 'National Gridiron League', short: 'NGL' }],
    durationMin: 200, slots: { kind: 'daily', hours: [0.5, 17, 20.5, 23.5] } },
  { sportId: 'baseball', engine: 'baseball', roster: { kind: 'teams', count: 14 },
    competitions: [{ name: 'Continental Baseball League', short: 'CBL' }],
    durationMin: 180, slots: { kind: 'daily', hours: [1.5, 16, 17.5, 19, 23] } },
  { sportId: 'ice_hockey', engine: 'h2h', roster: { kind: 'teams', count: 14 },
    competitions: [{ name: 'Frontier Hockey League', short: 'FHL' }],
    durationMin: 150, slots: { kind: 'daily', hours: [0, 1, 2.5, 18.5, 23] } },
  { sportId: 'aussie_rules', engine: 'h2h', roster: { kind: 'teams', count: 12 },
    competitions: [{ name: 'Southern Footy League', short: 'SFL' }],
    durationMin: 140, slots: { kind: 'daily', hours: [3, 5.5, 8.5, 9.5] } },
  { sportId: 'tennis', engine: 'tennis', roster: { kind: 'athletes', count: 32 },
    competitions: [{ name: 'Coastal Open', short: 'OPN' }, { name: 'Grand Masters', short: 'GMS' }],
    durationMin: 110, slots: { kind: 'rolling', everyMin: 70, offsetMin: 15 } },

  // ---- Wave 3 ----
  { sportId: 'golf', engine: 'golf', roster: { kind: 'athletes', count: 36 },
    competitions: [{ name: 'World Golf Tour', short: 'WGT' }],
    durationMin: 300, slots: { kind: 'daily', hours: [13] } },
  { sportId: 'motogp', engine: 'race', roster: { kind: 'athletes', count: 22, teams: 'racing', perTeam: 2 },
    competitions: [{ name: 'Moto Grand Prix Series', short: 'MGP' }],
    durationMin: 42, slots: { kind: 'daily', hours: [12, 15] } },
  { sportId: 'indycar', engine: 'race', roster: { kind: 'athletes', count: 20, teams: 'racing', perTeam: 2 },
    competitions: [{ name: 'Open-Wheel Championship', short: 'OWC' }],
    durationMin: 110, slots: { kind: 'daily', hours: [18, 21.5] } },
  { sportId: 'mma', engine: 'combat', roster: { kind: 'athletes', count: 24 },
    competitions: [{ name: 'Titan Combat League', short: 'TCL' }],
    durationMin: 20, slots: { kind: 'daily', hours: [1, 1.5, 2, 2.5, 3, 3.5, 20, 20.5, 21] } },
  { sportId: 'boxing', engine: 'combat', roster: { kind: 'athletes', count: 16 },
    competitions: [{ name: 'Championship Boxing', short: 'CBX' }],
    durationMin: 42, slots: { kind: 'daily', hours: [21, 22, 23] } },
  { sportId: 'cycling', engine: 'cycling', roster: { kind: 'athletes', count: 30, teams: 'cycling', perTeam: 5 },
    competitions: [{ name: 'Tour of the Coast', short: 'TOC' }],
    durationMin: 270, slots: { kind: 'daily', hours: [11] } },
  { sportId: 'netball', engine: 'h2h', roster: { kind: 'teams', count: 8 },
    competitions: [{ name: 'Premier Netball League', short: 'PNL' }],
    durationMin: 80, slots: { kind: 'daily', hours: [6, 8, 10, 19] } },
];

export const planFor = (sportId: string): SportPlan | undefined => PLANS.find((p) => p.sportId === sportId);
