// Individual sports: the athletes are the players.
// Motorsport, cycling, golf, tennis, MMA and boxing.
import type { SportStatsDef, StatLine } from '../types';
import { cell, join, n, stat, toPar } from './helpers';

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
const finish = (l: StatLine) => (n(l, 'pos') ? `P${n(l, 'pos')}` : null);

function racing(sportId: string, pos: string, label: string): SportStatsDef {
  // Championship points count in full where a win pays 25 (F1, MotoGP) and at
  // 0.4 in IndyCar, whose table pays 50 for a win and points deep into the field,
  // so a win is worth about the same in every series. Leading every lap is worth
  // about 5 points whatever the race distance; IndyCar's longer races have more
  // overtakes, so each counts a little less.
  const fantasy: Record<string, number> = sportId === 'indycar'
    ? { pts: 0.4, gained: 0.5, ot: 0.3, led: 0.06, fl: 3, dnf: -5 }
    : sportId === 'motogp'
      ? { pts: 1, gained: 0.5, ot: 0.5, led: 0.2, fl: 3, dnf: -5 }
      : { pts: 1, gained: 0.5, ot: 0.5, led: 0.1, fl: 3, dnf: -5 };
  const overtakes = (v: number) => (v ? `${v} overtake${v === 1 ? '' : 's'}` : null);
  return {
    sportId,
    positions: [],
    athletePos: { pos, label },
    labels: { grid: 'GRID', pos: 'POS', gained: '+/-', ot: 'OVT', led: 'LED', fl: 'FL', dnf: 'DNF', pts: 'PTS', pit: 'PIT' },
    fantasy,
    headline: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l), n(l, 'grid') ? `from P${n(l, 'grid')}` : null, n(l, 'pts') ? `${n(l, 'pts')} pts` : null, overtakes(n(l, 'ot'))]),
    feedLine: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l) ?? `from P${n(l, 'grid')}`, n(l, 'ot') ? `${n(l, 'ot')} OVT` : null], ', '),
    grid: () => [[stat('grid', 'GRID'), cell('FINISH', (l) => (n(l, 'dnf') ? 'DNF' : finish(l) ?? '–')), cell('+/-', (l) => signed(n(l, 'gained'))), stat('ot', 'OVT'), stat('led', 'LED'), stat('fl', 'FL'), stat('pts', 'PTS')]],
  };
}

export const f1 = racing('f1', 'Driver', 'Driver');
export const motogp = racing('motogp', 'Rider', 'Rider');
export const indycar = racing('indycar', 'Driver', 'Driver');

export const cycling: SportStatsDef = {
  sportId: 'cycling',
  positions: [],
  athletePos: { pos: 'Rider', label: 'Rider' },
  labels: { pos: 'POS', stagePts: 'PTS', bk: 'BREAK', kom: 'KOM', spr: 'SPRINT', att: 'ATT', dnf: 'DNF' },
  // A stage win (25) is the big prize; a day in the break with sprint and
  // mountain points is worth roughly 10-20, so the break alone does not beat it.
  fantasy: { stagePts: 1, bk: 3, kom: 0.4, spr: 0.25, att: 2, dnf: -5 },
  headline: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l), n(l, 'bk') ? 'in the break' : null, n(l, 'kom') ? `${n(l, 'kom')} KOM pts` : null, n(l, 'att') ? `${n(l, 'att')} attack${n(l, 'att') === 1 ? '' : 's'}` : null]),
  feedLine: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l), n(l, 'att') ? `${n(l, 'att')} ATT` : null, n(l, 'kom') ? `${n(l, 'kom')} KOM` : null], ', ') || 'in the bunch',
  grid: () => [[cell('FINISH', (l) => (n(l, 'dnf') ? 'DNF' : finish(l) ?? '–')), stat('stagePts', 'PTS'), stat('att', 'ATT'), stat('kom', 'KOM'), stat('spr', 'SPRINT'), cell('BREAK', (l) => (n(l, 'bk') ? 'Yes' : 'No'))]],
};

export const golf: SportStatsDef = {
  sportId: 'golf',
  positions: [],
  athletePos: { pos: 'Golfer', label: 'Golfer' },
  labels: { holes: 'HOLES', toPar: 'PAR', par: 'PARS', bird: 'BIRD', eag: 'EAGLE', bog: 'BOG', dbl: 'DBL+', hio: 'ACE', finish: 'FIN', pos: 'POS' },
  // Pars are the baseline. An ordinary round (a few birdies, a few bogeys) is
  // worth a handful of points, a low round 20 or more, and after the final round
  // the finishing bonus is added on top.
  fantasy: { bird: 2.5, eag: 6, bog: -1, dbl: -2, hio: 10, finish: 1 },
  headline: (l) => {
    const holes = n(l, 'holes');
    const under = n(l, 'bird') + n(l, 'eag') + n(l, 'hio');
    const place = n(l, 'pos');
    const suffix = [11, 12, 13].includes(place % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th';
    return join([toPar(n(l, 'toPar')), holes > 0 && holes < 18 ? `thru ${holes}` : holes === 18 ? `(${72 + n(l, 'toPar')})` : null,
      `${under} birdie${under === 1 ? '' : 's'}`, place ? `${place}${suffix}` : null]);
  },
  feedLine: (l) => `${toPar(n(l, 'toPar'))} thru ${n(l, 'holes')}`,
  grid: () => [
    [cell('SCORE', (l) => toPar(n(l, 'toPar'))), stat('holes', 'HOLES'), stat('bird', 'BIRD'), stat('eag', 'EAGLE'), stat('par', 'PARS')],
    [stat('bog', 'BOG'), stat('dbl', 'DBL+'), stat('hio', 'ACE'), cell('POS', (l) => (n(l, 'pos') ? `${n(l, 'pos')}` : '–'))],
  ],
};

export const tennis: SportStatsDef = {
  sportId: 'tennis',
  positions: [],
  athletePos: { pos: 'Player', label: 'Player' },
  labels: { sw: 'SETS', gw: 'GAMES', gl: 'LOST', aces: 'ACES', df: 'DF', brk: 'BRK', win: 'WIN' },
  // Straight-sets winner about 26, beaten in straight sets about 5, a three-set loser about 16.
  fantasy: { gw: 0.5, sw: 3, win: 8, aces: 0.5, df: -1, brk: 1.5 },
  headline: (l) => join([
    n(l, 'win') ? 'Won' : null,
    `${n(l, 'sw')} ${n(l, 'sw') === 1 ? 'set' : 'sets'}`,
    `${n(l, 'gw')} ${n(l, 'gw') === 1 ? 'game' : 'games'}`,
    `${n(l, 'aces')} ${n(l, 'aces') === 1 ? 'ace' : 'aces'}`,
  ]),
  feedLine: (l) => join([
    `${n(l, 'sw')} ${n(l, 'sw') === 1 ? 'set' : 'sets'}`, `${n(l, 'gw')} gms`,
    n(l, 'aces') ? `${n(l, 'aces')} ${n(l, 'aces') === 1 ? 'ace' : 'aces'}` : null,
  ], ', '),
  grid: () => [[stat('sw', 'SETS'), stat('gw', 'GAMES'), stat('gl', 'LOST'), stat('aces', 'ACES'), stat('df', 'DF'), stat('brk', 'BRK')]],
};

function combat(sportId: string, pos: string, label: string): SportStatsDef {
  const mma = sportId === 'mma';
  // Boxers land far more (punches, about 7 a minute) than MMA fighters land
  // significant strikes (about 4), so each one is worth less.
  const strikes = (v: number) => `${v} ${mma ? (v === 1 ? 'strike' : 'strikes') : v === 1 ? 'punch' : 'punches'}`;
  return {
    sportId,
    positions: [],
    athletePos: { pos, label },
    // Boxing has no takedowns or submissions.
    labels: mma ? { ss: 'STR', kd: 'KD', td: 'TD', sa: 'SUB', win: 'WIN', fin: 'FIN', r1: 'R1' } : { ss: 'STR', kd: 'KD', win: 'WIN', fin: 'FIN', r1: 'R1' },
    // Winner about 29 (a first-round finish 30), loser about 9 (a quick loss 2).
    fantasy: mma ? { ss: 0.1, kd: 4, td: 2, sa: 1, win: 12, fin: 8, r1: 6 } : { ss: 0.04, kd: 4, win: 12, fin: 8, r1: 6 },
    headline: (l) => join([n(l, 'win') ? (n(l, 'fin') ? 'Won inside the distance' : 'Won') : null, strikes(n(l, 'ss')), n(l, 'kd') ? `${n(l, 'kd')} kd` : null, n(l, 'td') ? `${n(l, 'td')} td` : null]),
    feedLine: (l) => join([`${n(l, 'ss')} STR`, n(l, 'kd') ? `${n(l, 'kd')} KD` : null, n(l, 'td') ? `${n(l, 'td')} TD` : null], ', '),
    grid: () => [[stat('ss', mma ? 'STRIKES' : 'PUNCHES'), stat('kd', 'KD'), ...(mma ? [stat('td', 'TD'), stat('sa', 'SUB ATT')] : []), cell('RESULT', (l) => (n(l, 'win') ? (n(l, 'fin') ? 'Finish' : 'Win') : '–'))]],
  };
}

export const mma = combat('mma', 'Fighter', 'Fighter');
export const boxing = combat('boxing', 'Boxer', 'Boxer');
