// Individual sports: the athletes are the players.
// Motorsport, cycling, golf, tennis, MMA and boxing.
import type { SportStatsDef, StatLine } from '../types';
import { cell, join, n, stat, toPar } from './helpers';

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
const finish = (l: StatLine) => (n(l, 'pos') ? `P${n(l, 'pos')}` : null);

function racing(sportId: string, pos: string, label: string): SportStatsDef {
  return {
    sportId,
    positions: [],
    athletePos: { pos, label },
    labels: { grid: 'GRID', pos: 'POS', gained: '+/-', ot: 'OVT', led: 'LED', fl: 'FL', dnf: 'DNF', pts: 'PTS', pit: 'PIT' },
    fantasy: { pts: 1, gained: 0.5, ot: 0.5, led: 0.1, fl: 3, dnf: -5 },
    headline: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l), n(l, 'grid') ? `from P${n(l, 'grid')}` : null, n(l, 'pts') ? `${n(l, 'pts')} pts` : null, n(l, 'ot') ? `${n(l, 'ot')} overtakes` : null]),
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
  fantasy: { stagePts: 1, bk: 5, kom: 0.5, spr: 0.5, att: 1, dnf: -5 },
  headline: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l), n(l, 'bk') ? 'in the break' : null, n(l, 'kom') ? `${n(l, 'kom')} KOM pts` : null, n(l, 'att') ? `${n(l, 'att')} attacks` : null]),
  feedLine: (l) => join([n(l, 'dnf') ? 'DNF' : finish(l), n(l, 'att') ? `${n(l, 'att')} ATT` : null, n(l, 'kom') ? `${n(l, 'kom')} KOM` : null], ', ') || 'in the bunch',
  grid: () => [[cell('FINISH', (l) => (n(l, 'dnf') ? 'DNF' : finish(l) ?? '–')), stat('stagePts', 'PTS'), stat('att', 'ATT'), stat('kom', 'KOM'), stat('spr', 'SPRINT'), cell('BREAK', (l) => (n(l, 'bk') ? 'Yes' : 'No'))]],
};

export const golf: SportStatsDef = {
  sportId: 'golf',
  positions: [],
  athletePos: { pos: 'Golfer', label: 'Golfer' },
  labels: { holes: 'HOLES', toPar: 'PAR', par: 'PARS', bird: 'BIRD', eag: 'EAGLE', bog: 'BOG', dbl: 'DBL+', hio: 'ACE', finish: 'FIN', pos: 'POS' },
  fantasy: { par: 0.5, bird: 3, eag: 8, bog: -0.5, dbl: -1, hio: 10, finish: 1 },
  headline: (l) => join([toPar(n(l, 'toPar')), n(l, 'holes') && n(l, 'holes') < 18 ? `thru ${n(l, 'holes')}` : `(${72 + n(l, 'toPar')})`, `${n(l, 'bird') + n(l, 'eag')} birdies`, n(l, 'pos') ? `T${n(l, 'pos')}` : null]),
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
  fantasy: { gw: 1, sw: 3, win: 5, aces: 0.5, df: -1, brk: 1.5 },
  headline: (l) => join([n(l, 'win') ? 'Won' : null, `${n(l, 'sw')} sets`, `${n(l, 'gw')} games`, `${n(l, 'aces')} aces`]),
  feedLine: (l) => join([`${n(l, 'sw')} sets`, `${n(l, 'gw')} gms`, n(l, 'aces') ? `${n(l, 'aces')} aces` : null], ', '),
  grid: () => [[stat('sw', 'SETS'), stat('gw', 'GAMES'), stat('gl', 'LOST'), stat('aces', 'ACES'), stat('df', 'DF'), stat('brk', 'BRK')]],
};

function combat(sportId: string, pos: string, label: string): SportStatsDef {
  return {
    sportId,
    positions: [],
    athletePos: { pos, label },
    labels: { ss: 'STR', kd: 'KD', td: 'TD', sa: 'SUB', win: 'WIN', fin: 'FIN', r1: 'R1' },
    fantasy: { ss: 0.2, kd: 4, td: 2, sa: 1, win: 10, fin: 8, r1: 6 },
    headline: (l) => join([n(l, 'win') ? (n(l, 'fin') ? 'Won inside the distance' : 'Won') : null, `${n(l, 'ss')} strikes`, n(l, 'kd') ? `${n(l, 'kd')} kd` : null, n(l, 'td') ? `${n(l, 'td')} td` : null]),
    feedLine: (l) => join([`${n(l, 'ss')} STR`, n(l, 'kd') ? `${n(l, 'kd')} KD` : null, n(l, 'td') ? `${n(l, 'td')} TD` : null], ', '),
    grid: () => [[stat('ss', 'STRIKES'), stat('kd', 'KD'), ...(sportId === 'mma' ? [stat('td', 'TD'), stat('sa', 'SUB ATT')] : []), cell('RESULT', (l) => (n(l, 'win') ? (n(l, 'fin') ? 'Finish' : 'Win') : '–'))]],
  };
}

export const mma = combat('mma', 'Fighter', 'Fighter');
export const boxing = combat('boxing', 'Boxer', 'Boxer');
