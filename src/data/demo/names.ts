// Invented places, clubs, and people for the demo world. Combinations are
// generated from these pools so the demo never implies a real team or result.

export const CITIES = [
  'Harbor City', 'Northgate', 'Ironbridge', 'Saltmarsh', 'Kingsmead', 'Blackwater', 'Highveld',
  'Redcliff', 'Westbrook', 'Eastmoor', 'Silverlake', 'Stonehaven', 'Riverton', 'Ashford Vale',
  'Granite Falls', 'Copperfield', 'Larkspur', 'Maple Ridge', 'Duneside', 'Port Avalon',
  'Cedar Point', 'Fairhaven', 'Thornbury', 'Glenmore', 'Brightwater', 'Oakhurst', 'Sunvale',
  'Falcon Bay', 'Marlowe', 'Pinecrest', 'Seacliff', 'Windmere', 'Old Quay', 'Coral Coast',
  'Ember Valley', 'Frostholm', 'Lowfield', 'Starling Heights', 'Ravensmoor', 'Bramblewick',
  'Tidewater', 'Hollowmere', 'Quarry Hill', 'Lanternport', 'Mistral Bay', 'Kestrel Downs',
  'Juniper Flats', 'Sablecrest', 'Vellum Point', 'Orchard Reach', 'Cobalt Sound', 'Saffron Hills',
] as const;

export const NICKNAMES: Record<string, readonly string[]> = {
  soccer: ['United', 'Rovers', 'Athletic', 'Wanderers', 'Albion', 'Town', 'Harriers', 'Rangers', 'FC', 'Dynamo', 'Sporting', 'Olympic'],
  basketball: ['Comets', 'Pilots', 'Ridge Runners', 'Tides', 'Volts', 'Blaze', 'Skyhawks', 'Nomads', 'Monarchs', 'Owls', 'Cyclones', 'Rapids', 'Embers', 'Breakers', 'Summit', 'Flyers'],
  rugby_union: ['RFC', 'Stags', 'Wolfhounds', 'Ironsides', 'Corsairs', 'Thunder', 'Highlanders XV', 'Mariners', 'Sentinels', 'Ravens', 'Bulls XV', 'Griffins'],
  rugby_league: ['Steelers', 'Rhinos XIII', 'Panthers XIII', 'Dockers', 'Miners', 'Raiders XIII', 'Seagulls', 'Brumbies XIII', 'Vikings', 'Stallions', 'Hornets', 'Wolves XIII'],
  american_football: ['Gridlocks', 'Outlaws', 'Ironclads', 'Mustangs', 'Prospectors', 'Riveters', 'Storm', 'Admirals', 'Bison', 'Talons', 'Frontiersmen', 'Lumberjacks', 'Hammers', 'Voyagers', 'Guardians', 'Wildcats'],
  baseball: ['Sluggers', 'Mariners', 'Clippers', 'Barons', 'Grays', 'Owls', 'Cardinals Club', 'Engineers', 'Pioneers', 'Sox', 'Spikes', 'Canaries', 'Drillers', 'Skippers'],
  ice_hockey: ['Blizzard', 'Icebreakers', 'Glaciers', 'Huskies', 'Avalanche Club', 'Polar Bears', 'Frost', 'Wolverines', 'Lumberjacks', 'Pucksters', 'Northstars', 'Yetis', 'Moose', 'Ravens'],
  aussie_rules: ['Magpies Club', 'Swans Club', 'Dockers FC', 'Hawks FC', 'Saints FC', 'Tigers FC', 'Lions FC', 'Bombers FC', 'Crows FC', 'Demons FC', 'Eagles FC', 'Giants FC'],
  netball: ['Fever Club', 'Vixens Club', 'Lightning Club', 'Swifts Club', 'Firebirds Club', 'Mavericks', 'Thunderbirds Club', 'Pulse Club'],
  cricket: ['Kings', 'Falcons', 'Royals', 'Strikers', 'Titans', 'Chargers', 'Hurricanes', 'Stars', 'Giants', 'Knights', 'Warriors', 'Sixers'],
};

export const FIRST_NAMES = [
  'Arlo', 'Mateo', 'Jonas', 'Ren', 'Sami', 'Dario', 'Kofi', 'Elias', 'Theo', 'Nico', 'Iker', 'Luka',
  'Ravi', 'Tomas', 'Felix', 'Oskar', 'Bruno', 'Idris', 'Caspian', 'Rafe', 'Leon', 'Milo', 'Emeka',
  'Hugo', 'Anders', 'Kai', 'Joaquin', 'Tariq', 'Malik', 'Soren', 'Viktor', 'Ezra', 'Callum', 'Nikhil',
  'Pablo', 'Yusuf', 'Aiden', 'Marek', 'Lorenzo', 'Desmond', 'Ines', 'Maya', 'Sofia', 'Amara', 'Lena',
  'Priya', 'Nadia', 'Zara', 'Elena', 'Harper', 'Ingrid', 'Yara', 'Chloe', 'Mira', 'Talia', 'Noor',
  'Freya', 'Ayla', 'Imani', 'Saoirse', 'Leila', 'Hana', 'Olivia', 'Beatriz', 'Keira', 'Astrid',
] as const;

export const SURNAMES = [
  'Vale', 'Okoro', 'Lindqvist', 'Tanaka', 'Moreau', 'Castell', 'Ferreira', 'Halvorsen', 'Brightmore',
  'Achterberg', 'Kowal', 'Haddad', 'Mensah', 'Ilunga', 'Sorensen', 'Varga', 'Takeda', 'Rinaldi',
  'Quinlan', 'Ostrander', 'Petrakis', 'Delacroix', 'Abernethy', 'Okafor', 'Duarte', 'Marchetti',
  'Novikov', 'Calloway', 'Ashdown', 'Bellamy', 'Carrow', 'Devereux', 'Eastwood', 'Fairweather',
  'Galloway', 'Hartigan', 'Ivers', 'Jarrow', 'Kingsley', 'Lockhart', 'Merriman', 'Northcott',
  'Ombasa', 'Pemberton', 'Quarles', 'Ransome', 'Saltonstall', 'Thackeray', 'Underhill', 'Vantongeren',
  'Whitlock', 'Yardley', 'Zabala', 'Amadi', 'Brennagh', 'Cortese', 'Drummond', 'Esterhuizen',
  'Fontaine', 'Gearhart', 'Holloway', 'Ibarra', 'Jovanic', 'Kariuki', 'Lachance', 'Mbatha',
  'Nakashima', 'Oyelaran', 'Paterno', 'Rasmussen', 'Strand', 'Toivonen', 'Uchenna', 'Valdivia',
  'Wexley', 'Yilmazer', 'Zorrilla', 'Arkwright', 'Banerji', 'Cheval', 'Dunmore', 'Elsworth',
] as const;

export const NATIONS = [
  'Norland', 'Calvera', 'Ostmark', 'Vesperia', 'Lumeria', 'Tarsis', 'Brevania', 'Kestria',
  'Solmara', 'Aldoria', 'Pelagia', 'Rovenia', 'Zantia', 'Meridia', 'Quorra', 'Halcyra',
] as const;

/** Constructors and racing teams: invented, two words, never a real brand. */
export const RACING_TEAMS = [
  'Apex Dynamics', 'Meridian Racing', 'Halo Works', 'Corsa Nova', 'Vector GP', 'Blackline Motorsport',
  'Solstice Racing', 'Ironwing GP', 'Polaris Speed', 'Tempest Engineering', 'Kinetic Union', 'Aurora Velocity',
] as const;

export const CYCLING_TEAMS = [
  'Team Altitude', 'Cadence Pro', 'Velo Meridian', 'Granfondo Collective', 'Spoke & Summit', 'Peloton Nova',
] as const;

export const VENUE_WORDS = ['Park', 'Stadium', 'Arena', 'Ground', 'Field', 'Oval', 'Dome', 'Bowl', 'Centre', 'Grounds'] as const;

export const CIRCUITS = [
  { city: 'Port Avalon', name: 'Port Avalon Street Circuit' },
  { city: 'Highveld', name: 'Highveld Ring' },
  { city: 'Mistral Bay', name: 'Mistral Bay Autodrome' },
  { city: 'Frostholm', name: 'Frostholm Raceway' },
  { city: 'Saffron Hills', name: 'Saffron Hills Circuit' },
  { city: 'Coral Coast', name: 'Coral Coast Speedway' },
  { city: 'Kestrel Downs', name: 'Kestrel Downs Park' },
  { city: 'Lanternport', name: 'Lanternport Harbour Circuit' },
] as const;

export const GOLF_COURSES = [
  'Juniper Flats Links', 'Sablecrest Country Club', 'Orchard Reach Golf Club', 'Cobalt Sound Dunes',
  'Ravensmoor Heath', 'Windmere National',
] as const;

export const FAN_WORDS_A = [
  'lap', 'try', 'six', 'dunk', 'corner', 'pole', 'birdie', 'apex', 'flick', 'sweeper', 'paddock',
  'gully', 'tifo', 'scrum', 'slipstream', 'buzzer', 'yorker', 'chip', 'volley', 'overlap', 'hattrick',
  'drs', 'parkthebus', 'fullback', 'coverdrive', 'breakaway',
] as const;

export const FAN_WORDS_B = [
  'king', 'queen', 'fan', 'nerd', 'hawk', 'ghost', 'wizard', 'chief', 'sage', 'owl', 'oracle',
  'nomad', 'prophet', 'machine', 'gremlin', 'legend', 'ultra', 'bandit', 'scout', 'captain',
] as const;

/** Kit colours [primary, secondary] for clubs. Assigned per league so rivals never clash. */
export const KIT_COLORS: readonly (readonly [string, string])[] = [
  ['#C8102E', '#FFFFFF'], ['#0057B8', '#FFFFFF'], ['#00843D', '#FFD100'], ['#5A2D82', '#F2C75C'],
  ['#F47A20', '#0B1F3A'], ['#0B1F3A', '#E4B53B'], ['#111111', '#F5D000'], ['#6CACE4', '#0B1F3A'],
  ['#8A1538', '#7EC8E3'], ['#FDB913', '#111111'], ['#007A78', '#F4F1E6'], ['#E03A3E', '#FDB927'],
  ['#1D428A', '#FFC72C'], ['#00A651', '#FFFFFF'], ['#7A263A', '#FFB81C'], ['#002D62', '#E31837'],
  ['#FF6B00', '#FFFFFF'], ['#4B2E83', '#FFFFFF'], ['#006BB6', '#F58426'], ['#CE1141', '#111111'],
  ['#00788C', '#F9A01B'], ['#2C2A29', '#C4CED4'], ['#E56020', '#1D1160'], ['#98002E', '#F9A01B'],
  ['#3A7D44', '#F2E8CF'], ['#00205B', '#FFFFFF'], ['#FFCD00', '#00205B'], ['#B4975A', '#0B1F3A'],
  ['#E4002B', '#002244'], ['#41B6E6', '#FFFFFF'], ['#702F8A', '#00B2A9'], ['#F9423A', '#2E2D2C'],
  ['#046A38', '#FFFFFF'], ['#A6192E', '#FFFFFF'], ['#0C2340', '#C8102E'], ['#DA291C', '#FFC72C'],
  ['#00B140', '#111111'], ['#1E3A8A', '#93C5FD'], ['#C99700', '#FFFFFF'], ['#EC008C', '#111111'],
];

/** Liveries for RACING_TEAMS, in the same order. */
export const RACING_COLORS: readonly (readonly [string, string])[] = [
  ['#E10600', '#FFFFFF'], ['#00A3E0', '#0B1F3A'], ['#FF8000', '#0B1F3A'], ['#1E5BC6', '#FFD400'],
  ['#00594F', '#C4E86B'], ['#F2F2F2', '#C8102E'], ['#8F979C', '#111111'], ['#2B4562', '#E8E8E8'],
  ['#6B21A8', '#F5D0FE'], ['#3BD16F', '#111111'], ['#FFD400', '#111111'], ['#E6007E', '#FFFFFF'],
];

/** Jerseys for CYCLING_TEAMS, in the same order. */
export const CYCLING_COLORS: readonly (readonly [string, string])[] = [
  ['#00A3E0', '#111111'], ['#E10600', '#FFFFFF'], ['#FFD400', '#111111'], ['#2E7D32', '#FFFFFF'],
  ['#6B21A8', '#FFFFFF'], ['#FF8000', '#111111'],
];

/** Flag colours for NATIONS, in the same order (solo athletes wear their nation). */
export const NATION_COLORS: readonly (readonly [string, string])[] = [
  ['#C8102E', '#FFFFFF'], ['#00843D', '#FFD100'], ['#111111', '#FFCE00'], ['#0057B8', '#FFD700'],
  ['#5A2D82', '#FFFFFF'], ['#E4002B', '#FFD100'], ['#00205B', '#FFFFFF'], ['#007A78', '#FFFFFF'],
  ['#F47A20', '#FFFFFF'], ['#6CACE4', '#FFFFFF'], ['#046A38', '#E4002B'], ['#8A1538', '#FFFFFF'],
  ['#1D428A', '#E31837'], ['#FDB913', '#0B1F3A'], ['#E03A3E', '#111111'], ['#41B6E6', '#0B1F3A'],
];
