// Gate Check: the daily bonus. Bigger streak, slightly bigger bonus. Mirrors gate_check().

export interface GateInput {
  clout: number;
  streakDays: number;
  lastGateCheck: string | null; // "YYYY-MM-DD" (UTC)
}

export interface GateResult {
  clout: number; // Clout added
  tix: number; // Tix added
  streakDays: number;
}

function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function canGateCheck(lastGateCheck: string | null, today: string): boolean {
  return lastGateCheck !== today;
}

export function computeGateCheck(input: GateInput, today: string): GateResult | { error: string } {
  if (input.lastGateCheck === today) return { error: 'You already checked in today. Come back tomorrow.' };
  const streakDays = input.lastGateCheck === previousDay(today) ? input.streakDays + 1 : 1;
  let clout = 100 + Math.min(streakDays, 7) * 10;
  const tix = 10 + Math.min(streakDays, 7);
  // Nobody gets stuck at zero: top up to at least 200 Clout.
  if (input.clout + clout < 200) clout = 200 - input.clout;
  return { clout, tix, streakDays };
}

/** Whether yesterday's streak is still alive (shown on the button). */
export function streakAlive(lastGateCheck: string | null, today: string): boolean {
  return lastGateCheck === today || lastGateCheck === previousDay(today);
}
