// American football: half-PPR fantasy scoring, the way most fantasy leagues do it,
// plus defensive players (IDP) and punters so every roster spot can be a card.
import type { SportStatsDef, StatLine } from '../types';
import { avg, cell, join, n, ratio, stat } from './helpers';

const yds = (l: StatLine) => n(l, 'rushYds') + n(l, 'recYds');
const tds = (l: StatLine) => n(l, 'rushTd') + n(l, 'recTd');
const fgMade = (l: StatLine) => n(l, 'fg3') + n(l, 'fg4') + n(l, 'fg5');

export const football: SportStatsDef = {
  sportId: 'american_football',
  positions: [
    { pos: 'QB', label: 'Quarterback', count: 1, numbers: [1, 19] },
    { pos: 'RB', label: 'Running back', count: 2, starters: 1, numbers: [20, 39] },
    { pos: 'WR', label: 'Wide receiver', count: 3, numbers: [10, 19] },
    { pos: 'TE', label: 'Tight end', count: 2, starters: 1, numbers: [80, 89] },
    { pos: 'K', label: 'Kicker', count: 1, numbers: [1, 9] },
    { pos: 'P', label: 'Punter', count: 1, numbers: [1, 9] },
    { pos: 'DL', label: 'Defensive lineman', count: 4, numbers: [90, 99] },
    { pos: 'LB', label: 'Linebacker', count: 3, numbers: [40, 59] },
    { pos: 'DB', label: 'Defensive back', count: 4, numbers: [20, 49] },
  ],
  labels: {
    passCmp: 'CMP', passAtt: 'ATT', passYds: 'PAYDS', passTd: 'PATD', passInt: 'INT', sacked: 'SCK', passLng: 'LNG',
    rushAtt: 'CAR', rushYds: 'RUYDS', rushTd: 'RUTD', rushLng: 'LNG',
    rec: 'REC', tgt: 'TGT', recYds: 'REYDS', recTd: 'RETD', recLng: 'LNG', yac: 'YAC',
    fumLost: 'FL', twoPt: '2PT',
    fgAtt: 'FGA', fg3: 'FG<40', fg4: 'FG40', fg5: 'FG50', fgMiss: 'FGM', fgLng: 'LNG', pat: 'XP', patMiss: 'XPM',
    punts: 'PUNTS', puntYds: 'PYDS', puntIn20: 'IN20',
    tkl: 'TKL', sacks: 'SACK', ints: 'INT', pd: 'PD', ff: 'FF', defTd: 'TD',
  },
  maxKeys: ['passLng', 'rushLng', 'recLng', 'fgLng'],
  fantasy: {
    passYds: 0.04, passTd: 4, passInt: -2,
    rushYds: 0.1, rushTd: 6,
    rec: 0.5, recYds: 0.1, recTd: 6,
    fumLost: -2, twoPt: 2,
    fg3: 3, fg4: 4, fg5: 5, fgMiss: -1, pat: 1, patMiss: -1,
    puntYds: 0.03, puntIn20: 1,
    tkl: 1, sacks: 2, ints: 3, pd: 1, ff: 2, defTd: 6,
  },
  headline: (l, pos) => {
    if (pos === 'QB') return join([`${n(l, 'passYds') + n(l, 'rushYds')} yds`, `${n(l, 'passTd') + n(l, 'rushTd')} td`, n(l, 'passInt') ? `${n(l, 'passInt')} int` : null]);
    if (pos === 'K') return join([`${fgMade(l)}/${n(l, 'fgAtt')} fg`, `${n(l, 'pat')} xp`]);
    if (pos === 'P') return join([`${n(l, 'punts')} punts`, `${avg(n(l, 'puntYds'), n(l, 'punts'))} avg`]);
    if (pos === 'DL' || pos === 'LB' || pos === 'DB') {
      return join([`${n(l, 'tkl')} tkl`, n(l, 'sacks') ? `${n(l, 'sacks')} sack` : null, n(l, 'ints') ? `${n(l, 'ints')} int` : null, n(l, 'pd') ? `${n(l, 'pd')} pd` : null]);
    }
    if (pos === 'RB') return join([`${yds(l)} yds`, `${tds(l)} td`, `${n(l, 'rec')} rec`]);
    return join([`${n(l, 'rec')} rec`, `${yds(l)} yds`, `${tds(l)} td`]);
  },
  feedLine: (l, pos, role) => {
    if (role === 'pass' || (!role && pos === 'QB')) return `${n(l, 'passYds')} yd, ${n(l, 'passCmp')}/${n(l, 'passAtt')}`;
    if (role === 'rush') return `${n(l, 'rushYds')} yd, ${n(l, 'rushAtt')} car`;
    if (role === 'rec' || (!role && (pos === 'WR' || pos === 'TE'))) return `${n(l, 'recYds')} yd, ${n(l, 'rec')} rec`;
    if (role === 'kick' || pos === 'K') return `${fgMade(l)}/${n(l, 'fgAtt')} FG, ${n(l, 'pat')} XP`;
    if (role === 'punt' || pos === 'P') return `${n(l, 'punts')} punts, ${avg(n(l, 'puntYds'), n(l, 'punts'))} avg`;
    if (role === 'def' || pos === 'DL' || pos === 'LB' || pos === 'DB') {
      return join([`${n(l, 'tkl')} tkl`, n(l, 'sacks') ? `${n(l, 'sacks')} sack` : null, n(l, 'ints') ? `${n(l, 'ints')} int` : null,
        n(l, 'pd') ? `${n(l, 'pd')} pd` : null], ', ');
    }
    if (role === 'ret') return 'kick return';
    return `${n(l, 'rushYds')} yd, ${n(l, 'rushAtt')} car`;
  },
  grid: (pos) => {
    const rushing = [stat('rushAtt', 'CAR'), stat('rushYds', 'RUYDS'), cell('RUAVG', (l) => avg(n(l, 'rushYds'), n(l, 'rushAtt'))), stat('rushTd', 'RUTD'), stat('rushLng', 'LNG')];
    const receiving = [stat('rec', 'REC'), stat('recYds', 'REYDS'), cell('REAVG', (l) => avg(n(l, 'recYds'), n(l, 'rec'))), stat('yac', 'YAC'), stat('recTd', 'RETD'), stat('recLng', 'LNG'), stat('fumLost', 'FL')];
    if (pos === 'QB') {
      return [
        [cell('CMP/ATT', (l) => ratio(n(l, 'passCmp'), n(l, 'passAtt'))), stat('passYds', 'PAYDS'), cell('AVG', (l) => avg(n(l, 'passYds'), n(l, 'passAtt'))), stat('passTd', 'TD'), stat('passInt', 'INT'), stat('sacked', 'SCK'), stat('passLng', 'LNG')],
        [...rushing, stat('fumLost', 'FL')],
      ];
    }
    if (pos === 'RB') return [[cell('YDS', yds), cell('TD', tds), ...rushing], receiving];
    if (pos === 'WR' || pos === 'TE') return [[stat('tgt', 'TGT'), ...receiving], rushing.slice(0, 4)];
    if (pos === 'K') {
      return [[cell('FG', (l) => ratio(fgMade(l), n(l, 'fgAtt'))), stat('fgLng', 'LNG'), stat('fg4', '40-49'), stat('fg5', '50+'), cell('XP', (l) => ratio(n(l, 'pat'), n(l, 'pat') + n(l, 'patMiss')))]];
    }
    if (pos === 'P') return [[stat('punts', 'PUNTS'), stat('puntYds', 'YDS'), cell('AVG', (l) => avg(n(l, 'puntYds'), n(l, 'punts'))), stat('puntIn20', 'IN20')]];
    return [[stat('tkl', 'TKL'), stat('sacks', 'SACK'), stat('ints', 'INT'), stat('pd', 'PD'), stat('ff', 'FF'), stat('defTd', 'TD')]];
  },
};
