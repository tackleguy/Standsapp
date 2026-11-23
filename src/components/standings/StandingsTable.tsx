// League tables, win-loss standings, championships and fighter rankings.
// One row per competitor, condensed numerals, qualification zones down the left edge.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { competitorById, type ChampionshipRow, type Result, type TeamRow } from '@/data/api';
import { withAlpha } from '@/lib/color';
import { colors, fonts, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Icon } from '../ui/Icon';

// ---------- Qualification zones ----------

export interface Zone { from: number; to: number; label: string; color: string }

/** Coloured bands down the left edge: titles, play-offs, relegation. */
export function zonesFor(sportId: string, size: number): Zone[] {
  const playoffs = (n: number, label = 'Play-offs'): Zone => ({ from: 1, to: n, label, color: colors.win });
  switch (sportId) {
    case 'soccer': return [
      { from: 1, to: 4, label: 'Continental Champions Cup', color: '#4DA3FF' },
      { from: 5, to: 5, label: 'Continental qualifiers', color: colors.win },
      { from: size - 2, to: size, label: 'Relegation', color: colors.live },
    ];
    case 'basketball': return [playoffs(6), { from: 7, to: 10, label: 'Play-in', color: colors.accent }];
    case 'american_football': return [playoffs(7)];
    case 'ice_hockey': return [playoffs(8)];
    case 'baseball': return [playoffs(6, 'Post-season')];
    case 'aussie_rules': return [playoffs(8, 'Finals')];
    case 'rugby_union': return [playoffs(4, 'Semi-finals'), { from: size, to: size, label: 'Relegation play-off', color: colors.live }];
    default: return [playoffs(4)];
  }
}

function zoneFor(zones: Zone[], position: number): Zone | undefined {
  return zones.find((z) => position >= z.from && position <= z.to);
}

// ---------- Small pieces ----------

const FORM_COLORS: Record<Result, string> = { W: colors.win, D: colors.loss, L: colors.live };

export function FormChip({ r, size = 18 }: { r: Result; size?: number }) {
  return (
    <View style={[styles.form, { width: size, height: size, backgroundColor: FORM_COLORS[r] }]}
      accessibilityLabel={r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'}>
      <Text style={[styles.formText, { fontSize: size * 0.62 }]}>{r}</Text>
    </View>
  );
}

export function FormStrip({ form, size }: { form: Result[]; size?: number }) {
  return <View style={styles.formRow}>{form.map((r, i) => <FormChip key={i} r={r} size={size} />)}</View>;
}

export function Movement({ n }: { n: number }) {
  if (n === 0) return <View style={styles.move}><View style={styles.moveDot} /></View>;
  const up = n > 0;
  return (
    <View style={styles.move} accessibilityLabel={`${up ? 'Up' : 'Down'} ${Math.abs(n)}`}>
      <Icon name={up ? 'caret-up' : 'caret-down'} size={11} color={up ? colors.up : colors.down} />
    </View>
  );
}

function Num({ children, w = 26, strong = false, color }: { children: string | number; w?: number; strong?: boolean; color?: string }) {
  return <Text style={[styles.num, { width: w }, strong && styles.numStrong, color ? { color } : null]} numberOfLines={1}>{children}</Text>;
}

function Head({ children, w = 26, left = false }: { children: string; w?: number; left?: boolean }) {
  return <Text style={[styles.head, { width: w }, left && { textAlign: 'left', flex: 1, width: undefined }]}>{children}</Text>;
}

// ---------- Team tables ----------

export type TableView = 'table' | 'form';

interface TeamTableProps {
  sportId: string;
  kind: 'table' | 'pct';
  rows: TeamRow[];
  view?: TableView;
  highlight?: Set<string>;
  /** Only show rows within this many places of a team (mini table). */
  around?: { id: string; radius: number };
  onPress?: (competitorId: string) => void;
  showZones?: boolean;
}

function TeamTableImpl({ sportId, kind, rows, view = 'table', highlight, around, onPress, showZones = true }: TeamTableProps) {
  const zones = showZones ? zonesFor(sportId, rows.length) : [];
  const hasDraws = rows.some((r) => r.drawn > 0);
  let shown = rows;
  if (around) {
    const idx = rows.findIndex((r) => r.competitorId === around.id);
    const start = Math.max(0, Math.min(rows.length - (around.radius * 2 + 1), idx - around.radius));
    shown = rows.slice(start, start + around.radius * 2 + 1);
  }
  const usedZones = zones.filter((z) => shown.some((r) => r.position >= z.from && r.position <= z.to));
  return (
    <View>
      <View style={[styles.row, styles.headRow]}>
        <Head w={30}>#</Head>
        <Head left>{kind === 'pct' ? 'Team' : 'Club'}</Head>
        {view === 'form' ? (<><Head w={112}>Last 5</Head><Head w={34}>{kind === 'pct' ? 'PCT' : 'PTS'}</Head></>)
          : kind === 'pct' ? (<><Head>W</Head><Head>L</Head><Head w={40}>PCT</Head><Head w={30}>GB</Head><Head w={32}>STRK</Head></>)
            : (<><Head>P</Head><Head>W</Head>{hasDraws ? <Head>D</Head> : null}<Head>L</Head><Head w={36}>+/-</Head><Head w={34}>PTS</Head></>)}
      </View>
      {shown.map((r) => {
        const c = competitorById(r.competitorId);
        const zone = zoneFor(zones, r.position);
        const mine = highlight?.has(r.competitorId);
        const diff = r.pointsFor - r.pointsAgainst;
        return (
          <Pressable key={r.competitorId} onPress={onPress ? () => onPress(r.competitorId) : undefined} disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${r.position}. ${c?.name}, ${kind === 'pct' ? `${r.won} wins ${r.lost} losses` : `${r.points} points`}`}
            style={({ pressed }) => [styles.row, mine && styles.rowMine, pressed && styles.pressed]}>
            <View style={[styles.zone, zone ? { backgroundColor: zone.color } : null]} />
            <View style={styles.posBox}>
              <Text style={styles.pos}>{r.position}</Text>
              <Movement n={r.movement} />
            </View>
            <View style={styles.teamCell}>
              <CompetitorBadge id={r.competitorId} size={22} />
              <Text style={[styles.team, mine && { color: colors.accent }]} numberOfLines={1}>{c?.name ?? '?'}</Text>
            </View>
            {view === 'form' ? (
              <>
                <View style={{ width: 112, alignItems: 'center' }}><FormStrip form={r.form} size={18} /></View>
                <Num w={34} strong>{kind === 'pct' ? r.pct.toFixed(3).replace(/^0/, '') : r.points}</Num>
              </>
            ) : kind === 'pct' ? (
              <>
                <Num>{r.won}</Num><Num>{r.lost}</Num>
                <Num w={40} strong>{r.pct.toFixed(3).replace(/^0/, '')}</Num>
                <Num w={30}>{r.gamesBack === 0 ? '–' : String(r.gamesBack)}</Num>
                <Num w={32} color={r.streak.startsWith('W') ? colors.win : colors.textDim}>{r.streak}</Num>
              </>
            ) : (
              <>
                <Num>{r.played}</Num><Num>{r.won}</Num>{hasDraws ? <Num>{r.drawn}</Num> : null}<Num>{r.lost}</Num>
                <Num w={36} color={diff > 0 ? colors.text : colors.textDim}>{diff > 0 ? `+${diff}` : diff}</Num>
                <Num w={34} strong>{r.points}</Num>
              </>
            )}
          </Pressable>
        );
      })}
      {usedZones.length > 0 ? (
        <View style={styles.legend}>
          {usedZones.map((z) => (
            <View key={z.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: z.color }]} />
              <Text style={styles.legendText}>{z.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const TeamTable = memo(TeamTableImpl);

// ---------- Championships ----------

export function ChampionshipTable({ rows, highlight, onPress, limit }: {
  rows: ChampionshipRow[]; highlight?: Set<string>; onPress?: (id: string) => void; limit?: number;
}) {
  const leader = rows[0]?.points ?? 0;
  return (
    <View>
      <View style={[styles.row, styles.headRow]}>
        <Head w={30}>#</Head><Head left>Name</Head><Head w={30}>WIN</Head><Head w={40}>GAP</Head><Head w={42}>PTS</Head>
      </View>
      {(limit ? rows.slice(0, limit) : rows).map((r) => {
        const c = competitorById(r.competitorId);
        const team = c?.parentId ? competitorById(c.parentId) : undefined;
        const mine = highlight?.has(r.competitorId) || (c?.parentId ? highlight?.has(c.parentId) : false);
        const podium = r.position <= 3 ? [colors.gold, colors.silver, colors.bronze][r.position - 1] : undefined;
        return (
          <Pressable key={r.competitorId} onPress={onPress ? () => onPress(r.competitorId) : undefined} disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${r.position}. ${c?.name}, ${r.points} points`}
            style={({ pressed }) => [styles.row, styles.rowTall, mine && styles.rowMine, pressed && styles.pressed]}>
            <View style={[styles.zone, podium ? { backgroundColor: podium } : null]} />
            <View style={styles.posBox}>
              <Text style={[styles.pos, podium ? { color: podium } : null]}>{r.position}</Text>
              <Movement n={r.movement} />
            </View>
            <View style={styles.teamCell}>
              <View style={[styles.livery, { backgroundColor: c?.colors?.[0] ?? colors.line }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.team, mine && { color: colors.accent }]} numberOfLines={1}>{c?.name ?? '?'}</Text>
                <Text style={styles.sub} numberOfLines={1}>{team?.name ?? c?.home ?? ''}</Text>
              </View>
            </View>
            <Num w={30}>{r.wins}</Num>
            <Num w={40} color={colors.textDim}>{r.position === 1 ? '–' : `-${leader - r.points}`}</Num>
            <Num w={42} strong>{r.points}</Num>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TeamsChampionshipTable({ rows, highlight, onPress }: {
  rows: { competitorId: string; position: number; points: number; wins: number }[]; highlight?: Set<string>; onPress?: (id: string) => void;
}) {
  return (
    <View>
      <View style={[styles.row, styles.headRow]}>
        <Head w={30}>#</Head><Head left>Team</Head><Head w={30}>WIN</Head><Head w={46}>PTS</Head>
      </View>
      {rows.map((r) => {
        const c = competitorById(r.competitorId);
        const mine = highlight?.has(r.competitorId);
        return (
          <Pressable key={r.competitorId} onPress={onPress ? () => onPress(r.competitorId) : undefined} disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${r.position}. ${c?.name}, ${r.points} points`}
            style={({ pressed }) => [styles.row, styles.rowTall, mine && styles.rowMine, pressed && styles.pressed]}>
            <View style={styles.zone} />
            <View style={styles.posBox}><Text style={styles.pos}>{r.position}</Text></View>
            <View style={styles.teamCell}>
              <View style={[styles.livery, { backgroundColor: c?.colors?.[0] ?? colors.line }]} />
              <Text style={[styles.team, mine && { color: colors.accent }]} numberOfLines={1}>{c?.name ?? '?'}</Text>
            </View>
            <Num w={30}>{r.wins}</Num>
            <Num w={46} strong>{r.points}</Num>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Fighter rankings ----------

export function FightRankings({ rows, highlight, onPress }: {
  rows: { competitorId: string; won: number; lost: number; drawn: number; finishes: number }[];
  highlight?: Set<string>; onPress?: (id: string) => void;
}) {
  return (
    <View>
      <View style={[styles.row, styles.headRow]}>
        <Head w={30}>#</Head><Head left>Fighter</Head><Head w={64}>RECORD</Head><Head w={40}>FIN</Head>
      </View>
      {rows.map((r, i) => {
        const c = competitorById(r.competitorId);
        const mine = highlight?.has(r.competitorId);
        return (
          <Pressable key={r.competitorId} onPress={onPress ? () => onPress(r.competitorId) : undefined} disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${i === 0 ? 'Champion' : `Ranked ${i}`}, ${c?.name}`}
            style={({ pressed }) => [styles.row, styles.rowTall, mine && styles.rowMine, pressed && styles.pressed]}>
            <View style={[styles.zone, i === 0 ? { backgroundColor: colors.gold } : null]} />
            <View style={styles.posBox}>
              {i === 0 ? <Icon name="trophy" size={14} color={colors.gold} /> : <Text style={styles.pos}>{i}</Text>}
            </View>
            <View style={styles.teamCell}>
              <CompetitorBadge id={r.competitorId} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.team, mine && { color: colors.accent }]} numberOfLines={1}>{c?.name ?? '?'}</Text>
                <Text style={styles.sub} numberOfLines={1}>{i === 0 ? 'Champion' : c?.home}</Text>
              </View>
            </View>
            <Num w={64} strong>{`${r.won}-${r.lost}-${r.drawn}`}</Num>
            <Num w={40}>{r.finishes}</Num>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowTall: { minHeight: 52 },
  headRow: { minHeight: 32, borderBottomWidth: 1, paddingLeft: 3 },
  rowMine: { backgroundColor: withAlpha(colors.accent, 0.08) },
  pressed: { backgroundColor: colors.surfaceHigh },
  zone: { width: 3, alignSelf: 'stretch', marginVertical: 6, borderRadius: 2, backgroundColor: 'transparent' },
  posBox: { width: 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 1 },
  pos: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  move: { width: 11, alignItems: 'center' },
  moveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.line },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.xs },
  team: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  sub: { ...type.label, fontSize: 11, color: colors.textDim, letterSpacing: 0.2 },
  livery: { width: 4, height: 28, borderRadius: 2 },
  head: { fontFamily: fonts.bold, fontSize: 12, color: colors.textDim, textAlign: 'center', letterSpacing: 0.8 },
  num: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  numStrong: { fontFamily: fonts.heavy, fontSize: 16 },
  form: { borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  formText: { fontFamily: fonts.heavy, color: '#0A0E17' },
  formRow: { flexDirection: 'row', gap: 4 },
  legend: { padding: space.lg, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { ...type.label, color: colors.textDim },
});
