// Score, number, and time formatting helpers. Pure functions, easy to test.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export { MINUTE, HOUR, DAY };

/** The current time. Use inside event handlers and timers, never while drawing. */
export function currentTime(): number {
  return Date.now();
}

/** 1234 -> "1,234"; 12500 -> "12.5k" when compact. */
export function formatNumber(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 10_000) {
    return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  }
  return Math.round(n).toLocaleString('en-US');
}

export function formatClout(n: number): string {
  return `${formatNumber(n)} Clout`;
}

export function formatTix(n: number): string {
  return `${formatNumber(n)} Tix`;
}

/** "7:30 PM" in the phone's own time zone. */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Sat 22 Nov" */
export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Local calendar key "2026-11-22" for grouping by the fan's own day. */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** UTC calendar key, used for the daily Gate Check (matches the server rule). */
export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Start of the fan's local day, in ms. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Tomorrow", "Yesterday", or "Sat 22 Nov". */
export function relativeDayLabel(dayStartMs: number, now: number): string {
  const today = startOfLocalDay(now);
  const diff = Math.round((startOfLocalDay(dayStartMs) - today) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDay(dayStartMs);
}

/** "just now", "4m", "2h", "3d". */
export function timeAgo(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < 45_000) return 'just now';
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))}m`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h`;
  return `${Math.round(diff / DAY)}d`;
}

/** "in 25m", "in 3h 10m", "in 2d". */
export function timeUntil(ms: number, now: number): string {
  const diff = ms - now;
  if (diff <= 0) return 'now';
  if (diff < HOUR) return `in ${Math.max(1, Math.ceil(diff / MINUTE))}m`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    const m = Math.floor((diff % HOUR) / MINUTE);
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  return `in ${Math.round(diff / DAY)}d`;
}

/** Ordinal: 1 -> "1st", 22 -> "22nd". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Multiplier "2.35x". */
export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}x`;
}

/** Race gap in seconds -> "+4.512s", laps -> "+1 lap". */
export function formatGap(seconds: number): string {
  if (seconds <= 0) return 'Leader';
  if (seconds >= 60) {
    const min = Math.floor(seconds / 60);
    const sec = (seconds - min * 60).toFixed(3).padStart(6, '0');
    return `+${min}:${sec}`;
  }
  return `+${seconds.toFixed(3)}s`;
}

/** Lap time in seconds -> "1:31.402". */
export function formatLapTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = (seconds - min * 60).toFixed(3).padStart(6, '0');
  return `${min}:${sec}`;
}

/** Golf to-par -> "-7", "E", "+2". */
export function formatToPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : String(n);
}

/** Cricket overs from balls: 110 -> "18.2". */
export function formatOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export function pct(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
