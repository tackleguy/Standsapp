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
