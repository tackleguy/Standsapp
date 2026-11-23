// Baseball and cricket: batters and pitchers / bowlers.
import type { SportStatsDef } from '../types';
import { cell, innings, join, n, stat } from './helpers';

const isPitcher = (pos: string) => pos === 'SP' || pos === 'RP';

export const baseball: SportStatsDef = {
  sportId: 'baseball',
  positions: [
    { pos: 'C', label: 'Catcher', count: 1, numbers: [2, 59] },
    { pos: '1B', label: 'First base', count: 1, numbers: [3, 59] },
    { pos: '2B', label: 'Second base', count: 1, numbers: [4, 59] },
    { pos: '3B', label: 'Third base', count: 1, numbers: [5, 59] },
    { pos: 'SS', label: 'Shortstop', count: 1, numbers: [6, 59] },
    { pos: 'LF', label: 'Left field', count: 1, numbers: [7, 59] },
    { pos: 'CF', label: 'Center field', count: 1, numbers: [8, 59] },
    { pos: 'RF', label: 'Right field', count: 1, numbers: [9, 59] },
    { pos: 'DH', label: 'Designated hitter', count: 1, numbers: [10, 59] },
    { pos: 'SP', label: 'Starting pitcher', count: 1, numbers: [30, 69] },
    { pos: 'RP', label: 'Relief pitcher', count: 3, numbers: [40, 79] },
  ],
  labels: {
    ab: 'AB', h: 'H', b1: '1B', b2: '2B', b3: '3B', hr: 'HR', r: 'R', rbi: 'RBI', bb: 'BB', so: 'K', sb: 'SB',
    outs: 'OUTS', kp: 'K', er: 'ER', ha: 'H', bba: 'BB', w: 'W', sv: 'SV',
  },
  // Daily-fantasy style scoring, with runs and RBIs a touch richer so an everyday hitter averages ~8-9.
  fantasy: { b1: 3, b2: 5, b3: 8, hr: 10, r: 2.5, rbi: 2.5, bb: 2, sb: 5, outs: 0.75, kp: 2, er: -2, ha: -0.6, bba: -0.6, w: 4, sv: 5 },
  headline: (l, pos) => (isPitcher(pos)
    ? join([`${innings(n(l, 'outs'))} ip`, `${n(l, 'kp')} k`, `${n(l, 'er')} er`])
    : join([`${n(l, 'h')}-${n(l, 'ab')}`, n(l, 'hr') ? `${n(l, 'hr')} hr` : null, n(l, 'rbi') ? `${n(l, 'rbi')} rbi` : null, n(l, 'r') ? `${n(l, 'r')} r` : null])),
  feedLine: (l, pos, role) => (role === 'pitch' || (!role && isPitcher(pos))
    ? `${innings(n(l, 'outs'))} IP, ${n(l, 'kp')} K, ${n(l, 'er')} ER`
    : join([`${n(l, 'h')}-${n(l, 'ab')}`, n(l, 'rbi') ? `${n(l, 'rbi')} RBI` : null], ', ')),
  grid: (pos) => (isPitcher(pos)
    ? [[cell('IP', (l) => innings(n(l, 'outs'))), stat('ha', 'H'), stat('er', 'ER'), stat('bba', 'BB'), stat('kp', 'K')],
      [cell('ERA', (l) => (n(l, 'outs') > 0 ? ((n(l, 'er') * 27) / n(l, 'outs')).toFixed(2) : '–')), stat('w', 'W'), stat('sv', 'SV')]]
    : [[stat('ab', 'AB'), stat('h', 'H'), stat('r', 'R'), stat('rbi', 'RBI'), stat('hr', 'HR')],
      [stat('b2', '2B'), stat('b3', '3B'), stat('bb', 'BB'), stat('so', 'K'), stat('sb', 'SB')]]),
};

const isBowler = (pos: string) => pos === 'BOWL';

export const cricket: SportStatsDef = {
  sportId: 'cricket',
  positions: [
    { pos: 'BAT', label: 'Batter', count: 5, numbers: [1, 99] },
    { pos: 'WK', label: 'Wicketkeeper', count: 1, numbers: [1, 99] },
    { pos: 'AR', label: 'All-rounder', count: 2, numbers: [1, 99] },
    { pos: 'BOWL', label: 'Bowler', count: 4, starters: 3, numbers: [1, 99] },
  ],
  labels: { runs: 'R', balls: 'B', fours: '4S', sixes: '6S', out: 'OUT', wkts: 'W', bb: 'BALLS', rc: 'RUNS', md: 'MD', ct: 'CT', st: 'ST', ro: 'RO' },
  // Bowlers also earn 0.3 a ball and lose 0.2 a run conceded: break-even at 9 an over,
  // so a tidy wicketless spell still counts and an expensive one costs a little.
  fantasy: { runs: 0.4, fours: 0.4, sixes: 0.8, wkts: 8, md: 4, ct: 3, st: 4, ro: 3, bb: 0.3, rc: -0.2 },
  headline: (l, pos) => {
    const bat = n(l, 'balls') > 0 ? `${n(l, 'runs')}${n(l, 'out') ? '' : '*'} (${n(l, 'balls')})` : null;
    const bowl = n(l, 'bb') > 0 ? `${n(l, 'wkts')}/${n(l, 'rc')} (${Math.floor(n(l, 'bb') / 6)}${n(l, 'bb') % 6 ? `.${n(l, 'bb') % 6}` : ''})` : null;
    return join(isBowler(pos) ? [bowl, bat] : [bat, bowl], ' · ') || 'did not bat';
  },
  feedLine: (l, pos, role) => (role === 'bowl' || (!role && isBowler(pos))
    ? `${n(l, 'wkts')}/${n(l, 'rc')}`
    : `${n(l, 'runs')}${n(l, 'out') ? '' : '*'} (${n(l, 'balls')})`),
  grid: () => [
    [stat('runs', 'R'), stat('balls', 'B'), cell('SR', (l) => (n(l, 'balls') ? ((n(l, 'runs') * 100) / n(l, 'balls')).toFixed(0) : '–')), stat('fours', '4S'), stat('sixes', '6S')],
    [cell('OVERS', (l) => `${Math.floor(n(l, 'bb') / 6)}.${n(l, 'bb') % 6}`), stat('wkts', 'W'), stat('rc', 'RUNS'),
      cell('ECON', (l) => (n(l, 'bb') ? ((n(l, 'rc') * 6) / n(l, 'bb')).toFixed(1) : '–')), stat('ct', 'CT')],
  ],
};

