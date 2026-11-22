// The single source of truth for which sports Stands supports.
export type EventFormat = 'head_to_head' | 'race' | 'innings';

export interface SportConfig {
  id: string; // stable key used in the database
  name: string; // shown to fans
  format: EventFormat; // which of the three shapes it uses
  icon: string; // Ionicons glyph name, never a league logo
  periodWord: string; // "Quarter", "Half", "Lap", "Over", "Set"...
  launchWave: 1 | 2 | 3; // 1 = must work at first launch
  competitions: string[]; // display names of the first competitions to load
}

export const SPORTS: SportConfig[] = [
  // Wave 1: the three headline additions plus the two biggest global sports
  { id: 'f1', name: 'Formula 1', format: 'race', icon: 'speedometer',
    periodWord: 'Lap', launchWave: 1, competitions: ['Formula 1 World Championship'] },
  { id: 'cricket', name: 'Cricket', format: 'innings', icon: 'baseball',
    periodWord: 'Over', launchWave: 1,
    competitions: ['International Tests', 'One Day Internationals', 'T20 Internationals', 'Indian Premier League', 'Big Bash League', 'The Hundred'] },
  { id: 'rugby_union', name: 'Rugby Union', format: 'head_to_head', icon: 'american-football',
    periodWord: 'Half', launchWave: 1,
    competitions: ['Six Nations', 'The Rugby Championship', 'Rugby World Cup', 'Premiership Rugby', 'United Rugby Championship', 'Top 14', 'Super Rugby Pacific'] },
  { id: 'soccer', name: 'Soccer', format: 'head_to_head', icon: 'football',
    periodWord: 'Half', launchWave: 1,
    competitions: ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League', 'MLS', 'NWSL'] },
  { id: 'basketball', name: 'Basketball', format: 'head_to_head', icon: 'basketball',
    periodWord: 'Quarter', launchWave: 1, competitions: ['NBA', 'WNBA', 'EuroLeague', 'NCAA Men', 'NCAA Women'] },

  // Wave 2: the rest of the major team sports
  { id: 'rugby_league', name: 'Rugby League', format: 'head_to_head', icon: 'american-football',
    periodWord: 'Half', launchWave: 2, competitions: ['NRL', 'Super League', 'State of Origin'] },
  { id: 'american_football', name: 'Football', format: 'head_to_head', icon: 'american-football',
    periodWord: 'Quarter', launchWave: 2, competitions: ['NFL', 'NCAA Football'] },
  { id: 'baseball', name: 'Baseball', format: 'head_to_head', icon: 'baseball',
    periodWord: 'Inning', launchWave: 2, competitions: ['MLB', 'NPB', 'KBO'] },
  { id: 'ice_hockey', name: 'Hockey', format: 'head_to_head', icon: 'snow',
    periodWord: 'Period', launchWave: 2, competitions: ['NHL', 'PWHL'] },
  { id: 'aussie_rules', name: 'Aussie Rules', format: 'head_to_head', icon: 'ellipse',
    periodWord: 'Quarter', launchWave: 2, competitions: ['AFL', 'AFLW'] },
  { id: 'tennis', name: 'Tennis', format: 'head_to_head', icon: 'tennisball',
    periodWord: 'Set', launchWave: 2, competitions: ['Grand Slams', 'ATP Tour', 'WTA Tour'] },

  // Wave 3: individual and racing sports
  { id: 'golf', name: 'Golf', format: 'race', icon: 'golf',
    periodWord: 'Round', launchWave: 3, competitions: ['Majors', 'PGA Tour', 'LPGA Tour', 'DP World Tour'] },
  { id: 'motogp', name: 'MotoGP', format: 'race', icon: 'bicycle',
    periodWord: 'Lap', launchWave: 3, competitions: ['MotoGP World Championship'] },
  { id: 'indycar', name: 'IndyCar', format: 'race', icon: 'speedometer',
    periodWord: 'Lap', launchWave: 3, competitions: ['IndyCar Series'] },
  { id: 'mma', name: 'MMA', format: 'head_to_head', icon: 'hand-left',
    periodWord: 'Round', launchWave: 3, competitions: ['UFC', 'PFL'] },
  { id: 'boxing', name: 'Boxing', format: 'head_to_head', icon: 'hand-right',
    periodWord: 'Round', launchWave: 3, competitions: ['World Title Fights'] },
  { id: 'cycling', name: 'Cycling', format: 'race', icon: 'bicycle',
    periodWord: 'Stage', launchWave: 3, competitions: ['Grand Tours', 'Monuments'] },
  { id: 'netball', name: 'Netball', format: 'head_to_head', icon: 'basketball',
    periodWord: 'Quarter', launchWave: 3, competitions: ['Super Netball', 'Netball Super League'] },
];

export const sportById = (id: string) => SPORTS.find((s) => s.id === id);
export const launchSports = (wave: 1 | 2 | 3) => SPORTS.filter((s) => s.launchWave <= wave);
