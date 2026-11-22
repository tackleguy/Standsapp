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
  rarity: { common: '#9AA6BD', rare: '#4DA3FF', epic: '#B47CFF', legendary: '#FFB627' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const type = {
  score: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
} as const;
