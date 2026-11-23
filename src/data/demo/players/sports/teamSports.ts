// Stats and fantasy scoring for the team sports the generic two-sided simulator
// plays: soccer, basketball, hockey, both rugby codes, Aussie rules and netball.
// Scoring is tuned so a typical starter scores about 8-12 points a game and a
// standout game 25 or more, in every sport.
import type { SportStatsDef } from '../types';
import { cell, count, join, n, pct, ratio, stat } from './helpers';

export const soccer: SportStatsDef = {
  sportId: 'soccer',
  positions: [
    { pos: 'GK', label: 'Goalkeeper', count: 1, numbers: [1, 1] },
    { pos: 'DF', label: 'Defender', count: 5, starters: 4, numbers: [2, 6] },
    { pos: 'MF', label: 'Midfielder', count: 5, starters: 4, numbers: [7, 16] },
    { pos: 'FW', label: 'Forward', count: 3, starters: 2, numbers: [9, 29] },
  ],
  labels: { app: 'APP', min: 'MIN', g: 'G', a: 'A', sh: 'SH', sot: 'SOT', kp: 'KP', tkl: 'TKL', int: 'INT', sv: 'SV', ga: 'GA', cs: 'CS', yc: 'YC', rc: 'RC', og: 'OG' },
  fantasy: { app: 2, g: 8, a: 5, sh: 0.5, sot: 1, kp: 1, tkl: 1, int: 0.5, sv: 1.5, ga: -1, cs: 5, yc: -1, rc: -3, og: -3 },
  headline: (l, pos) => (pos === 'GK'
    ? join([`${n(l, 'sv')} saves`, n(l, 'cs') ? 'clean sheet' : `${n(l, 'ga')} conceded`])
    : join([n(l, 'g') ? `${n(l, 'g')} g` : null, n(l, 'a') ? `${n(l, 'a')} a` : null, `${n(l, 'sh')} shots`, n(l, 'tkl') ? `${n(l, 'tkl')} tkl` : null])),
  feedLine: (l, pos) => (pos === 'GK' ? `${n(l, 'sv')} SV, ${n(l, 'ga')} GA` : join([`${n(l, 'g')} G`, `${n(l, 'a')} A`, `${n(l, 'sh')} SH`], ', ')),
  grid: (pos) => (pos === 'GK'
    ? [[stat('sv', 'SV'), stat('ga', 'GA'), stat('cs', 'CS'), cell('SV%', (l) => pct(n(l, 'sv'), n(l, 'sv') + n(l, 'ga'))), stat('min', 'MIN')]]
    : [[stat('g', 'G'), stat('a', 'A'), stat('sh', 'SH'), stat('sot', 'SOT'), stat('kp', 'KP')],
      [stat('tkl', 'TKL'), stat('int', 'INT'), stat('yc', 'YC'), stat('rc', 'RC'), stat('min', 'MIN')]]),
};

export const basketball: SportStatsDef = {
  sportId: 'basketball',
  positions: [
    { pos: 'PG', label: 'Point guard', count: 2, starters: 1, numbers: [0, 15] },
    { pos: 'SG', label: 'Shooting guard', count: 2, starters: 1, numbers: [1, 25] },
    { pos: 'SF', label: 'Small forward', count: 2, starters: 1, numbers: [2, 35] },
    { pos: 'PF', label: 'Power forward', count: 2, starters: 1, numbers: [4, 45] },
    { pos: 'C', label: 'Center', count: 2, starters: 1, numbers: [5, 55] },
  ],
  labels: { min: 'MIN', pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', to: 'TO', fgm: 'FGM', fga: 'FGA', tpm: '3PM', tpa: '3PA', ftm: 'FTM', fta: 'FTA' },
  fantasy: { pts: 0.5, reb: 0.6, ast: 0.75, stl: 1.5, blk: 1.5, to: -0.5 },
  headline: (l) => join([`${n(l, 'pts')} pts`, `${n(l, 'reb')} reb`, `${n(l, 'ast')} ast`]),
  feedLine: (l) => join([`${n(l, 'pts')} pts`, `${n(l, 'reb')} reb`, `${n(l, 'ast')} ast`], ', '),
  grid: () => [
    [stat('pts', 'PTS'), stat('reb', 'REB'), stat('ast', 'AST'), stat('stl', 'STL'), stat('blk', 'BLK'), stat('to', 'TO')],
    [cell('FG', (l) => ratio(n(l, 'fgm'), n(l, 'fga'))), cell('FG%', (l) => pct(n(l, 'fgm'), n(l, 'fga'))), cell('3PT', (l) => ratio(n(l, 'tpm'), n(l, 'tpa'))),
      cell('FT', (l) => ratio(n(l, 'ftm'), n(l, 'fta'))), stat('min', 'MIN')],
  ],
};

export const iceHockey: SportStatsDef = {
  sportId: 'ice_hockey',
  positions: [
    { pos: 'C', label: 'Center', count: 3, numbers: [10, 29] },
    { pos: 'LW', label: 'Left wing', count: 3, numbers: [11, 39] },
    { pos: 'RW', label: 'Right wing', count: 3, numbers: [12, 49] },
    { pos: 'D', label: 'Defenseman', count: 6, numbers: [2, 8] },
    { pos: 'G', label: 'Goaltender', count: 2, starters: 1, numbers: [30, 39] },
  ],
  labels: { g: 'G', a: 'A', sog: 'SOG', hit: 'HIT', blk: 'BLK', pim: 'PIM', pm: '+/-', fow: 'FOW', sv: 'SV', ga: 'GA', so: 'SO', w: 'W' },
  fantasy: { g: 4, a: 2.5, sog: 0.6, hit: 0.3, blk: 0.5, sv: 0.3, ga: -1, so: 3, w: 3 },
  headline: (l, pos) => (pos === 'G'
    ? join([`${n(l, 'sv')} saves`, n(l, 'so') ? 'shutout' : `${n(l, 'ga')} ga`])
    : join([n(l, 'g') ? `${n(l, 'g')} g` : null, n(l, 'a') ? `${n(l, 'a')} a` : null, `${n(l, 'sog')} sog`, n(l, 'hit') ? `${n(l, 'hit')} hits` : null])),
  feedLine: (l, pos) => (pos === 'G' ? `${n(l, 'sv')} SV, ${n(l, 'ga')} GA` : join([`${n(l, 'g')} G`, `${n(l, 'a')} A`, `${n(l, 'sog')} SOG`], ', ')),
  grid: (pos) => (pos === 'G'
    ? [[stat('sv', 'SV'), stat('ga', 'GA'), cell('SV%', (l) => pct(n(l, 'sv'), n(l, 'sv') + n(l, 'ga'))), stat('so', 'SO'), stat('w', 'W')]]
    : [[stat('g', 'G'), stat('a', 'A'), cell('PTS', (l) => n(l, 'g') + n(l, 'a')), stat('sog', 'SOG'), stat('pm', '+/-')],
      [stat('hit', 'HIT'), stat('blk', 'BLK'), stat('pim', 'PIM'), stat('fow', 'FOW')]]),
};

export const rugbyUnion: SportStatsDef = {
  sportId: 'rugby_union',
  positions: [
    { pos: 'PR', label: 'Prop', count: 3, starters: 2, numbers: [1, 3] },
    { pos: 'HK', label: 'Hooker', count: 1, numbers: [2, 2] },
    { pos: 'LK', label: 'Lock', count: 3, starters: 2, numbers: [4, 5] },
    { pos: 'FL', label: 'Flanker', count: 2, numbers: [6, 7] },
    { pos: 'N8', label: 'Number 8', count: 1, numbers: [8, 8] },
    { pos: 'SH', label: 'Scrum-half', count: 2, starters: 1, numbers: [9, 9] },
    { pos: 'FH', label: 'Fly-half', count: 1, numbers: [10, 10] },
    { pos: 'CE', label: 'Centre', count: 2, numbers: [12, 13] },
    { pos: 'WG', label: 'Wing', count: 2, numbers: [11, 14] },
    { pos: 'FB', label: 'Fullback', count: 1, numbers: [15, 15] },
  ],
  labels: { t: 'T', c: 'CON', p: 'PEN', dg: 'DG', car: 'CAR', m: 'M', lb: 'LB', off: 'OFF', tkl: 'TKL', mt: 'MT', tw: 'TW', yc: 'YC', rc: 'RC' },
  fantasy: { t: 10, c: 2, p: 3, dg: 3, car: 0.2, m: 0.1, lb: 2, off: 1, tkl: 0.5, mt: -0.5, tw: 2, yc: -3, rc: -6 },
  headline: (l) => join([count(n(l, 't'), 'try', 'tries'), `${n(l, 'm')} m`, n(l, 'tkl') ? `${n(l, 'tkl')} tkl` : null, n(l, 'c') + n(l, 'p') ? `${n(l, 'c') * 2 + n(l, 'p') * 3} kick pts` : null]),
  feedLine: (l) => join([count(n(l, 't'), 'try', 'tries'), `${n(l, 'm')} m`, `${n(l, 'tkl')} tkl`], ', '),
  grid: () => [
    [stat('t', 'T'), stat('m', 'M'), stat('car', 'CAR'), stat('lb', 'LB'), stat('off', 'OFF')],
    [stat('tkl', 'TKL'), stat('mt', 'MT'), stat('tw', 'TW'), cell('KICK', (l) => `${n(l, 'c')}C ${n(l, 'p')}P`), stat('yc', 'YC')],
  ],
};

export const rugbyLeague: SportStatsDef = {
  sportId: 'rugby_league',
  positions: [
    { pos: 'FB', label: 'Fullback', count: 1, numbers: [1, 1] },
    { pos: 'WG', label: 'Wing', count: 2, numbers: [2, 5] },
    { pos: 'CE', label: 'Centre', count: 2, numbers: [3, 4] },
    { pos: 'FE', label: 'Five-eighth', count: 1, numbers: [6, 6] },
    { pos: 'HB', label: 'Halfback', count: 1, numbers: [7, 7] },
    { pos: 'PR', label: 'Prop', count: 3, starters: 2, numbers: [8, 10] },
    { pos: 'HK', label: 'Hooker', count: 2, starters: 1, numbers: [9, 14] },
    { pos: 'SR', label: 'Second row', count: 3, starters: 2, numbers: [11, 12] },
    { pos: 'LK', label: 'Lock', count: 1, numbers: [13, 13] },
  ],
  labels: { t: 'T', ta: 'TA', g: 'GOAL', fg: 'FG', run: 'RUNS', m: 'M', lb: 'LB', off: 'OFF', tkl: 'TKL', mt: 'MT', err: 'ERR' },
  fantasy: { t: 8, ta: 5, g: 2, fg: 2, m: 0.05, lb: 3, off: 1, tkl: 0.25, mt: -1, err: -2 },
  headline: (l) => join([count(n(l, 't'), 'try', 'tries'), `${n(l, 'm')} m`, n(l, 'tkl') ? `${n(l, 'tkl')} tkl` : null, n(l, 'ta') ? `${n(l, 'ta')} ta` : null]),
  feedLine: (l) => join([count(n(l, 't'), 'try', 'tries'), `${n(l, 'm')} m`, `${n(l, 'tkl')} tkl`], ', '),
  grid: () => [
    [stat('t', 'T'), stat('ta', 'TA'), stat('m', 'M'), stat('run', 'RUNS'), stat('lb', 'LB')],
    [stat('tkl', 'TKL'), stat('mt', 'MT'), stat('off', 'OFF'), stat('err', 'ERR'), stat('g', 'GOALS')],
  ],
};

export const aussieRules: SportStatsDef = {
  sportId: 'aussie_rules',
  positions: [
    { pos: 'DEF', label: 'Defender', count: 7, starters: 6, numbers: [1, 20] },
    { pos: 'MID', label: 'Midfielder', count: 8, starters: 7, numbers: [2, 40] },
    { pos: 'RUC', label: 'Ruck', count: 2, starters: 1, numbers: [11, 50] },
    { pos: 'FWD', label: 'Forward', count: 7, starters: 6, numbers: [3, 45] },
  ],
  labels: { g: 'G', b: 'B', k: 'K', hb: 'HB', mk: 'MK', tkl: 'TKL', ho: 'HO', cl: 'CLR', i50: 'I50' },
  fantasy: { g: 1.5, b: 0.2, k: 0.3, hb: 0.2, mk: 0.3, tkl: 0.4, ho: 0.1, cl: 0.3 },
  headline: (l) => join([`${n(l, 'k') + n(l, 'hb')} disposals`, n(l, 'g') ? `${n(l, 'g')}.${n(l, 'b')} goals` : null, n(l, 'tkl') ? `${n(l, 'tkl')} tkl` : null]),
  feedLine: (l) => join([`${n(l, 'g')}.${n(l, 'b')}`, `${n(l, 'k') + n(l, 'hb')} D`, `${n(l, 'mk')} M`], ', '),
  grid: () => [
    [cell('D', (l) => n(l, 'k') + n(l, 'hb')), stat('k', 'K'), stat('hb', 'HB'), stat('mk', 'MK'), stat('tkl', 'TKL')],
    [stat('g', 'G'), stat('b', 'B'), stat('ho', 'HO'), stat('cl', 'CLR'), stat('i50', 'I50')],
  ],
};

export const netball: SportStatsDef = {
  sportId: 'netball',
  positions: [
    { pos: 'GS', label: 'Goal shooter', count: 2, starters: 1, numbers: [1, 99] },
    { pos: 'GA', label: 'Goal attack', count: 1, numbers: [1, 99] },
    { pos: 'WA', label: 'Wing attack', count: 1, numbers: [1, 99] },
    { pos: 'C', label: 'Centre', count: 2, starters: 1, numbers: [1, 99] },
    { pos: 'WD', label: 'Wing defence', count: 1, numbers: [1, 99] },
    { pos: 'GD', label: 'Goal defence', count: 1, numbers: [1, 99] },
    { pos: 'GK', label: 'Goal keeper', count: 2, starters: 1, numbers: [1, 99] },
  ],
  labels: { g: 'G', miss: 'MISS', fd: 'FEED', gass: 'GA', cpr: 'CPR', int: 'INT', dfl: 'DEF', reb: 'REB', pen: 'PEN', to: 'TO' },
  fantasy: { g: 0.4, miss: -0.2, fd: 0.3, gass: 1, cpr: 0.2, int: 2, dfl: 1, reb: 0.6, pen: -0.1, to: -1 },
  headline: (l, pos) => (pos === 'GS' || pos === 'GA'
    ? join([`${n(l, 'g')}/${n(l, 'g') + n(l, 'miss')} goals`, n(l, 'gass') ? `${n(l, 'gass')} assists` : null])
    : join([`${n(l, 'int')} int`, `${n(l, 'dfl')} deflections`, n(l, 'fd') ? `${n(l, 'fd')} feeds` : null])),
  feedLine: (l, pos) => (pos === 'GS' || pos === 'GA'
    ? `${n(l, 'g')}/${n(l, 'g') + n(l, 'miss')}`
    : join([`${n(l, 'int')} INT`, `${n(l, 'dfl')} DEF`, `${n(l, 'fd')} FD`], ', ')),
  grid: () => [
    [cell('GOALS', (l) => ratio(n(l, 'g'), n(l, 'g') + n(l, 'miss'))), cell('%', (l) => pct(n(l, 'g'), n(l, 'g') + n(l, 'miss'))), stat('gass', 'GA'), stat('fd', 'FEEDS'), stat('cpr', 'CPR')],
    [stat('int', 'INT'), stat('dfl', 'DEF'), stat('reb', 'REB'), stat('pen', 'PEN'), stat('to', 'TO')],
  ],
};

