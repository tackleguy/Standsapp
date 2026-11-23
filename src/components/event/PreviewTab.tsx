// Before the start: countdown, win probability, the crowd's pick, form,
// league positions, season records, head-to-head, grid or tale of the tape.
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { sportById } from '@/config/sports';
import {
  championship, competitorById, crowdLabel, crowdPick, eventWinProbability, fightRecord, headToHead, leagueName, ordinal,
  standingsKind, teamRow, teamsChampionship, watchersFor, type Result, type TeamRow,
} from '@/data/api';
import { raceSnapshot } from '@/data/demo/engines/race';
import type { EventState } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { withAlpha } from '@/lib/color';
import { formatDay, formatTime } from '@/lib/format';
import { hasTrackMap } from '@/lib/tracks';
import { sportHasDraws } from '@/logic/winProbability';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { GamePackBanner } from '../cards/GamePackBanner';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { LiveDot } from '../ui/LiveDot';
import { sideColors, teamColor } from './teamColor';
import { WinProbBar } from './WinProbBar';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function Countdown({ state, now }: { state: EventState; now: number }) {
  const { meta } = state;
  const ms = Math.max(0, meta.startsAt - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const early = watchersFor(state, now);
  const word = meta.format === 'race' ? (hasTrackMap(meta.sportId) ? 'Lights out in' : 'Start in')
    : meta.sportId === 'soccer' || meta.sportId.startsWith('rugby') ? 'Kick-off in'
      : meta.sportId === 'mma' || meta.sportId === 'boxing' ? 'Walkouts in' : 'Starts in';
  const units = d > 0 ? [[d, 'DAYS'], [h, 'HRS'], [m, 'MIN']] : [[h, 'HRS'], [m, 'MIN'], [s, 'SEC']];
  return (
    <View style={styles.countdown} accessibilityLabel={`${word} ${d ? `${d} days ` : ''}${h} hours ${m} minutes`}>
      <Text style={styles.cdWord}>{word}</Text>
      <View style={styles.cdRow}>
        {units.map(([v, label], i) => (
          <View key={String(label)} style={styles.cdRow}>
            {i > 0 ? <Text style={styles.cdColon}>:</Text> : null}
            <View style={styles.cdUnit}>
              <Text style={styles.cdNum}>{pad(v as number)}</Text>
              <Text style={styles.cdLabel}>{label}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.cdMeta}>{formatDay(meta.startsAt)} · {formatTime(meta.startsAt)} · {meta.venue}</Text>
      {early > 0 ? (
        <View style={styles.early}>
          <LiveDot size={6} />
          <Text style={styles.earlyText}>{crowdLabel(early)} fans here early</Text>
        </View>
      ) : null}
    </View>
  );
}

const RESULT_COLOR: Record<Result, string> = { W: colors.win, D: colors.loss, L: colors.live };

function FormChips({ form }: { form: Result[] }) {
  if (form.length === 0) return <Text style={styles.muted}>No games yet</Text>;
  return (
    <View style={styles.form}>
      {form.map((r, i) => (
        <View key={i} style={[styles.formChip, { backgroundColor: withAlpha(RESULT_COLOR[r], 0.2), borderColor: RESULT_COLOR[r] },
          i === form.length - 1 && styles.formLatest]}>
          <Text style={[styles.formText, { color: RESULT_COLOR[r] }]}>{r}</Text>
        </View>
      ))}
    </View>
  );
}

function TeamsPreview({ state, now, onMakeCalls }: { state: EventState; now: number; onMakeCalls: () => void }) {
  const router = useRouter();
  const { meta } = state;
  const [homeId, awayId] = meta.competitorIds;
  const [homeColor, awayColor] = sideColors(homeId, awayId);
  const prob = useMemo(() => eventWinProbability(state), [state]);
  // Re-read the crowd once a minute; the countdown ticks every second.
  const minute = Math.floor(now / 60_000);
  const pick = useMemo(() => crowdPick(meta, minute * 60_000), [meta, minute]);
  const kind = standingsKind(meta.sportId);
  const rows = useMemo(() => [teamRow(homeId, now), teamRow(awayId, now)] as [TeamRow | undefined, TeamRow | undefined], [homeId, awayId, now]);
  const meetings = useMemo(() => headToHead(homeId, awayId, now, 5), [homeId, awayId, now]);
  const draws = sportHasDraws(meta.sportId);
  const home = competitorById(homeId);
  const away = competitorById(awayId);
  const openTable = () => router.push(`/standings/${meta.sportId}`);
  const h2hSummary = meetings.reduce((acc, m) => {
    const homeWon = (m.result === 'H' && m.homeId === homeId) || (m.result === 'A' && m.awayId === homeId);
    if (m.result === 'D') acc.d++; else if (homeWon) acc.h++; else acc.a++;
    return acc;
  }, { h: 0, d: 0, a: 0 });

  return (
    <>
      {prob ? (
        <Card title="Win probability" right={<Text style={styles.source}>Stands model</Text>}>
          <WinProbBar prob={prob} homeId={homeId} awayId={awayId} homeColor={homeColor} awayColor={awayColor} draws={draws} label="" large />
        </Card>
      ) : null}

      {pick ? (
        <Card title="Who wins? The crowd says" right={<Text style={styles.source}>{pick.votes.toLocaleString('en-US')} picks</Text>}>
          {[{ id: homeId, label: home?.name ?? 'Home', pct: pick.home, color: homeColor },
            ...(draws ? [{ id: 'draw', label: 'Draw', pct: pick.draw, color: colors.loss }] : []),
            { id: awayId, label: away?.name ?? 'Away', pct: pick.away, color: awayColor }].map((o) => (
            <View key={o.id} style={styles.pickRow}>
              <View style={[styles.pickFill, { width: `${o.pct}%`, backgroundColor: withAlpha(o.color, 0.22) }]} />
              <Text style={styles.pickLabel} numberOfLines={1}>{o.label}</Text>
              <Text style={[styles.pickPct, { color: o.color }]}>{o.pct}%</Text>
            </View>
          ))}
          <Button label="Make your Call" icon="flash" onPress={onMakeCalls} small style={{ marginTop: space.xs }} />
        </Card>
      ) : null}

      {kind === 'record' && home && away ? (
        <TaleOfTheTape homeId={homeId} awayId={awayId} homeColor={homeColor} awayColor={awayColor} />
      ) : null}

      {(kind === 'table' || kind === 'pct') && rows[0] && rows[1] ? (
        <Card title="Form · last 5" right={
          <Pressable onPress={openTable} accessibilityRole="link" hitSlop={8} style={styles.linkRow}>
            <Text style={styles.link}>Full table</Text><Icon name="chevron-forward" size={14} color={colors.accent} />
          </Pressable>
        }>
          {[{ id: homeId, row: rows[0] }, { id: awayId, row: rows[1] }].map(({ id, row }) => (
            <View key={id} style={styles.formRow}>
              <CompetitorBadge id={id} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName} numberOfLines={1}>{competitorById(id)?.name}</Text>
                <Text style={styles.muted}>
                  {kind === 'table' ? `${ordinal(row.position)} in ${leagueName(meta.sportId)} · ${row.points} pts` : `${row.won}-${row.lost} · ${ordinal(row.position)} · ${row.streak}`}
                </Text>
              </View>
              <FormChips form={row.form} />
            </View>
          ))}
        </Card>
      ) : null}

      {(kind === 'table' || kind === 'pct') && rows[0] && rows[1] ? (
        <Card title="Season so far">
          <View style={styles.compareHead}>
            <Text style={[styles.compareTeam, { color: homeColor }]}>{home?.shortName}</Text>
            <Text style={[styles.compareTeam, { color: awayColor, textAlign: 'right' }]}>{away?.shortName}</Text>
          </View>
          {([
            ['Position', ordinal(rows[0].position), ordinal(rows[1].position), rows[1].position - rows[0].position],
            ['Played', rows[0].played, rows[1].played, 0],
            ['Won', rows[0].won, rows[1].won, rows[0].won - rows[1].won],
            ...(draws ? [['Drawn', rows[0].drawn, rows[1].drawn, 0]] : []),
            ['Lost', rows[0].lost, rows[1].lost, rows[1].lost - rows[0].lost],
            [meta.sportId === 'soccer' || meta.sportId === 'ice_hockey' ? 'Goals for' : 'Points for', rows[0].pointsFor, rows[1].pointsFor, rows[0].pointsFor - rows[1].pointsFor],
            [meta.sportId === 'soccer' || meta.sportId === 'ice_hockey' ? 'Goals against' : 'Points against', rows[0].pointsAgainst, rows[1].pointsAgainst, rows[1].pointsAgainst - rows[0].pointsAgainst],
            ...(kind === 'table' ? [['League points', rows[0].points, rows[1].points, rows[0].points - rows[1].points]] : [['Win %', rows[0].pct.toFixed(3).replace(/^0/, ''), rows[1].pct.toFixed(3).replace(/^0/, ''), rows[0].pct - rows[1].pct]]),
          ] as [string, string | number, string | number, number][]).map(([label, a, b, edge]) => (
            <View key={label} style={styles.compareRow}>
              <Text style={[styles.compareVal, edge > 0 && { color: colors.text, fontFamily: fonts.heavy }]}>{a}</Text>
              <Text style={styles.compareLabel}>{label}</Text>
              <Text style={[styles.compareVal, { textAlign: 'right' }, edge < 0 && { color: colors.text, fontFamily: fonts.heavy }]}>{b}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {meetings.length > 0 ? (
        <Card title="Head to head" right={<Text style={styles.source}>Last {meetings.length}</Text>}>
          <View style={styles.h2hSummary}>
            <View style={styles.h2hItem}><Text style={[styles.h2hNum, { color: homeColor }]}>{h2hSummary.h}</Text><Text style={styles.h2hLabel}>{home?.shortName} wins</Text></View>
            {draws ? <View style={styles.h2hItem}><Text style={styles.h2hNum}>{h2hSummary.d}</Text><Text style={styles.h2hLabel}>Draws</Text></View> : null}
            <View style={styles.h2hItem}><Text style={[styles.h2hNum, { color: awayColor }]}>{h2hSummary.a}</Text><Text style={styles.h2hLabel}>{away?.shortName} wins</Text></View>
          </View>
          {meetings.map((m) => (
            <View key={`${m.round}:${m.at}`} style={styles.meeting}>
              <Text style={styles.meetDate}>{new Date(m.at).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })}</Text>
              <Text style={[styles.meetTeam, m.result === 'H' && styles.meetWin]} numberOfLines={1}>{competitorById(m.homeId)?.shortName}</Text>
              <Text style={styles.meetScore}>{m.home} – {m.away}</Text>
              <Text style={[styles.meetTeam, { textAlign: 'left' }, m.result === 'A' && styles.meetWin]} numberOfLines={1}>{competitorById(m.awayId)?.shortName}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function TaleOfTheTape({ homeId, awayId, homeColor, awayColor }: { homeId: string; awayId: string; homeColor: string; awayColor: string }) {
  const home = competitorById(homeId);
  const away = competitorById(awayId);
  if (!home || !away) return null;
  const a = fightRecord(home);
  const b = fightRecord(away);
  const rows: [string, string, string][] = [
    ['Record', `${a.won}-${a.lost}-${a.drawn}`, `${b.won}-${b.lost}-${b.drawn}`],
    ['Wins by stoppage', String(a.finishes), String(b.finishes)],
    ['Finish rate', `${Math.round((a.finishes / Math.max(1, a.won)) * 100)}%`, `${Math.round((b.finishes / Math.max(1, b.won)) * 100)}%`],
    ['Ranking', a.ranking ? `#${a.ranking}` : 'NR', b.ranking ? `#${b.ranking}` : 'NR'],
    ['Fighting out of', home.home, away.home],
  ];
  return (
    <Card title="Tale of the tape">
      <View style={styles.compareHead}>
        <Text style={[styles.compareTeam, { color: homeColor }]} numberOfLines={1}>{home.name}</Text>
        <Text style={[styles.compareTeam, { color: awayColor, textAlign: 'right' }]} numberOfLines={1}>{away.name}</Text>
      </View>
      {rows.map(([label, x, y]) => (
        <View key={label} style={styles.compareRow}>
          <Text style={styles.compareVal}>{x}</Text>
          <Text style={styles.compareLabel}>{label}</Text>
          <Text style={[styles.compareVal, { textAlign: 'right' }]}>{y}</Text>
        </View>
      ))}
    </Card>
  );
}

function RacePreview({ state, now }: { state: EventState; now: number }) {
  const router = useRouter();
  const { meta } = state;
  const motor = hasTrackMap(meta.sportId);
  const grid = useMemo(() => (motor ? raceSnapshot(meta, now).cars.slice(0, 10) : []), [motor, meta, now]);
  const standings = useMemo(() => championship(meta.sportId, now).slice(0, 10), [meta.sportId, now]);
  const teams = useMemo(() => (motor ? teamsChampionship(meta.sportId, now).slice(0, 5) : []), [motor, meta.sportId, now]);
  const leaderPts = standings[0]?.points ?? 0;
  return (
    <>
      {grid.length > 0 ? (
        <Card title="Starting grid">
          {grid.map((c) => (
            <View key={c.competitorId} style={styles.gridRow}>
              <Text style={[styles.gridPos, c.position === 1 && { color: colors.gold }]}>{c.position}</Text>
              <View style={[styles.teamBar, { backgroundColor: teamColor(c.competitorId) }]} />
              <Text style={styles.teamName} numberOfLines={1}>{competitorById(c.competitorId)?.name}</Text>
              <Text style={styles.muted} numberOfLines={1}>{competitorById(competitorById(c.competitorId)?.parentId)?.name ?? ''}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {standings.length > 0 ? (
        <Card title={sportById(meta.sportId)?.id === 'tennis' ? 'Rankings' : motor ? "Drivers' championship" : 'Season standings'} right={
          <Pressable onPress={() => router.push(`/standings/${meta.sportId}`)} accessibilityRole="link" hitSlop={8} style={styles.linkRow}>
            <Text style={styles.link}>Full standings</Text><Icon name="chevron-forward" size={14} color={colors.accent} />
          </Pressable>
        }>
          {standings.map((r) => (
            <View key={r.competitorId} style={styles.gridRow}>
              <Text style={[styles.gridPos, r.position === 1 && { color: colors.gold }]}>{r.position}</Text>
              <CompetitorBadge id={r.competitorId} size={22} />
              <Text style={styles.teamName} numberOfLines={1}>{competitorById(r.competitorId)?.name}</Text>
              <Text style={styles.points}>{r.points}</Text>
              <Text style={styles.gap}>{r.position === 1 ? '' : `-${leaderPts - r.points}`}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {teams.length > 0 ? (
        <Card title="Teams' championship">
          {teams.map((t) => (
            <View key={t.competitorId} style={styles.gridRow}>
              <Text style={styles.gridPos}>{t.position}</Text>
              <View style={[styles.teamBar, { backgroundColor: teamColor(t.competitorId) }]} />
              <Text style={styles.teamName} numberOfLines={1}>{competitorById(t.competitorId)?.name}</Text>
              <Text style={styles.points}>{t.points}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function TennisRanks({ state, now }: { state: EventState; now: number }) {
  const rows = useMemo(() => championship(state.meta.sportId, now), [state.meta.sportId, now]);
  const [a, b] = state.meta.competitorIds.map((id) => rows.find((r) => r.competitorId === id));
  if (!a || !b) return null;
  return (
    <Card title="Rankings">
      {[a, b].map((r) => (
        <View key={r.competitorId} style={styles.formRow}>
          <CompetitorBadge id={r.competitorId} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName} numberOfLines={1}>{competitorById(r.competitorId)?.name}</Text>
            <Text style={styles.muted}>World No. {r.position} · {r.points.toLocaleString('en-US')} pts · {r.wins} titles</Text>
          </View>
          <View style={styles.form}>
            {r.recent.map((pos, i) => (
              <View key={i} style={[styles.formChip, { borderColor: pos === 1 ? colors.gold : colors.line }]}>
                <Text style={[styles.formText, { color: pos === 1 ? colors.gold : colors.textDim, fontSize: 11 }]}>{pos === 1 ? 'W' : pos <= 2 ? 'F' : pos <= 4 ? 'SF' : pos <= 8 ? 'QF' : 'R'}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}

export function PreviewTab({ state, onScroll, onMakeCalls }: { state: EventState; onScroll: ScrollHandler; onMakeCalls: () => void }) {
  const now = useNow(1000);
  // Season tables only move between rounds; a once-a-minute clock is plenty for them.
  const tableNow = Math.floor(now / 60_000) * 60_000;
  const { meta } = state;
  const isTennis = meta.sportId === 'tennis';
  return (
    <ScrollView onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={styles.body}>
      <Countdown state={state} now={now} />
      <View style={{ marginHorizontal: space.lg }}><GamePackBanner state={state} now={now} /></View>
      {meta.format === 'race' ? <RacePreview state={state} now={tableNow} /> : (
        <>
          <TeamsPreview state={state} now={tableNow} onMakeCalls={onMakeCalls} />
          {isTennis ? <TennisRanks state={state} now={tableNow} /> : null}
        </>
      )}
      {meta.format === 'race' ? <Button label="Make your Calls" icon="flash" onPress={onMakeCalls} style={{ marginHorizontal: space.lg }} /> : null}
      <Text style={styles.footnote}>Play-by-play starts at {formatTime(meta.startsAt)}. Calls lock when the action begins.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: space.md, paddingBottom: 80, gap: space.md },
  card: { marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space.lg, gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardTitle: { ...type.caps, fontSize: 14, color: colors.textDim, flex: 1 },
  source: { ...type.label, fontSize: 11, color: colors.loss },
  countdown: { marginHorizontal: space.lg, alignItems: 'center', gap: space.sm, paddingVertical: space.lg,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  cdWord: { ...type.caps, fontSize: 14, color: colors.accent },
  cdRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cdUnit: { alignItems: 'center', minWidth: 64 },
  cdNum: { fontFamily: fonts.black, fontSize: 52, lineHeight: 56, color: colors.text, fontVariant: ['tabular-nums'] },
  cdLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.textDim, letterSpacing: 1.5 },
  cdColon: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 52, color: colors.line, marginHorizontal: 2 },
  cdMeta: { ...type.label, color: colors.textDim, textAlign: 'center', paddingHorizontal: space.lg },
  early: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,77,94,0.1)', borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4 },
  earlyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, letterSpacing: 0.3 },
  pickRow: { height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, overflow: 'hidden', flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: space.md },
  pickFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  pickLabel: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  pickPct: { fontFamily: fonts.heavy, fontSize: 20, fontVariant: ['tabular-nums'] },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { ...type.label, color: colors.accent },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  teamName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  muted: { ...type.label, color: colors.textDim, fontWeight: '500' },
  form: { flexDirection: 'row', gap: 4 },
  formChip: { minWidth: 22, height: 22, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  formLatest: { transform: [{ scale: 1.1 }] },
  formText: { fontFamily: fonts.heavy, fontSize: 13 },
  compareHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  compareTeam: { fontFamily: fonts.heavy, fontSize: 16, letterSpacing: 0.5, flex: 1 },
  compareRow: { flexDirection: 'row', alignItems: 'center', minHeight: 26, borderTopWidth: 1, borderColor: colors.line, paddingTop: 4 },
  compareVal: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textDim, fontVariant: ['tabular-nums'] },
  compareLabel: { flex: 1.4, ...type.label, color: colors.textDim, textAlign: 'center' },
  h2hSummary: { flexDirection: 'row', justifyContent: 'space-around' },
  h2hItem: { alignItems: 'center' },
  h2hNum: { fontFamily: fonts.black, fontSize: 34, color: colors.text },
  h2hLabel: { ...type.label, color: colors.textDim },
  meeting: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: 1, borderColor: colors.line, paddingTop: 6 },
  meetDate: { ...type.label, color: colors.loss, width: 74 },
  meetTeam: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.textDim, textAlign: 'right' },
  meetWin: { color: colors.text },
  meetScore: { fontFamily: fonts.heavy, fontSize: 17, color: colors.text, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 30 },
  gridPos: { fontFamily: fonts.heavy, fontSize: 16, color: colors.textDim, width: 22, textAlign: 'center' },
  teamBar: { width: 4, height: 20, borderRadius: 2 },
  points: { fontFamily: fonts.heavy, fontSize: 16, color: colors.text, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  gap: { fontFamily: fonts.semibold, fontSize: 13, color: colors.loss, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  footnote: { ...type.label, color: colors.loss, textAlign: 'center', paddingHorizontal: space.xl },
});
