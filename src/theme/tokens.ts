// "Floodlights at night": deep blue-black, one warm amber accent, crisp white numerals.
export const colors = {
  bg: '#0A0E17', // night sky
  surface: '#131A27', // cards
  surfaceHigh: '#1C2536', // pressed and raised
  line: '#263149',
  text: '#F4F6FA',
  textDim: '#9AA6BD',
  accent: '#FFB627', // floodlight amber
  accentInk: '#1A1200', // text on amber
  live: '#FF4D5E',
  win: '#3DDC97',
  loss: '#7C879C',
  up: '#3DDC97', // rank moved up
  down: '#FF6B78', // rank moved down
  gold: '#FFC83D',
  silver: '#C9D3E3',
  bronze: '#E09A5A',
  rarity: { common: '#9AA6BD', rare: '#4DA3FF', epic: '#B47CFF', legendary: '#FFB627' },
  /** Leaderboard tiers, lowest to highest. */
  tier: { bronze: '#E09A5A', silver: '#C9D3E3', gold: '#FFC83D', platinum: '#7FE3D6', diamond: '#8FB8FF', legend: '#FF7AD9' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

/**
 * Condensed display faces for scores, clocks, ranks and headings (loaded in the
 * root layout). Never pair these with fontWeight: the weight is in the face, and
 * adding fontWeight makes some phones fall back to the system font.
 */
export const fonts = {
  semibold: 'BarlowCondensed_600SemiBold',
  bold: 'BarlowCondensed_700Bold',
  heavy: 'BarlowCondensed_800ExtraBold',
  black: 'BarlowCondensed_900Black',
} as const;

export const type = {
  score: { fontFamily: fonts.heavy, fontSize: 34, fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  /** Big condensed headline: wordmark, screen titles. */
  display: { fontFamily: fonts.black, fontSize: 34, letterSpacing: 0.2 },
  /** Condensed caps for section headings, clocks and small stats. */
  caps: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
} as const;
