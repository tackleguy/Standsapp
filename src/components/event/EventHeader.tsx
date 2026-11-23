// The live scoreboard at the top of an event: team colours, big condensed
// numerals, a game clock that ticks every second, scorers, who is watching,
// and the live win probability. Shrinks to one line once you scroll.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { sportById } from '@/config/sports';
import {
  competitorById, crowdLabel, eventWinProbability, getWorld, liveClock, ordinal, recordLine, redCardsFor, scorersFor,
  standingsKind, teamRow, watchersFor, type Scorer,
} from '@/data/api';
import { raceSnapshot } from '@/data/demo/engines/race';
import type { EntryState, EventState } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { withAlpha } from '@/lib/color';
import { formatDay, formatTime, timeUntil } from '@/lib/format';
import { hasTrackMap } from '@/lib/tracks';
import { sportHasDraws } from '@/logic/winProbability';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Icon, sportIcon } from '../ui/Icon';
import { LiveDot } from '../ui/LiveDot';
import { FlashScore } from './FlashScore';
import { sideColors, teamColor } from './teamColor';
import { TeamGlow } from '../ui/TeamGlow';
import { WinProbBar } from './WinProbBar';

/** "3rd · 25 pts", "12-4", "P2 · 143 pts", "22-3-0". */
export function standingLine(competitorId: string, now: number): string | null {
  const c = competitorById(competitorId);
  if (!c) return null;
  if (standingsKind(c.sportId) === 'table') {
    const row = teamRow(competitorId, now);
    return row ? `${ordinal(row.position)} · ${row.points} pts` : null;
  }
  if (c.sportId === 'tennis') {
    const line = recordLine(competitorId, now);
    const pos = line ? /^P(\d+)/.exec(line)?.[1] : null;
    return pos ? `World No. ${pos}` : line;
  }
  return recordLine(competitorId, now);
}

const SCORER_ICON: Record<string, string> = {
  soccer: '⚽', ice_hockey: '🏒', rugby_union: '🏉', rugby_league: '🏉', american_football: '🏈', baseball: '⚾',
};

function groupScorers(list: Scorer[]): string[] {
  const byName = new Map<string, string[]>();
  for (const s of list) byName.set(s.name, [...(byName.get(s.name) ?? []), s.clock]);
  return [...byName.entries()].map(([name, clocks]) => `${name} ${clocks.join(', ')}`);
}

function Side({ entry, align, compact, finished, color, now, reds }: {
  entry: EntryState; align: 'left' | 'right'; compact: boolean; finished: boolean; color: string; now: number; reds: number;
}) {
  const router = useRouter();
  const c = competitorById(entry.competitorId);
  const dim = finished && entry.isWinner === false;
  const record = useMemo(() => (compact ? null : standingLine(entry.competitorId, now)), [entry.competitorId, now, compact]);
  const open = () => router.push({ pathname: '/competitor/[id]', params: { id: entry.competitorId } });
  if (compact) {
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open ${c?.name ?? 'team'}`}
        style={[styles.sideCompact, align === 'right' && styles.sideCompactRight]}>
        <CompetitorBadge id={entry.competitorId} size={26} />
        <Text style={[styles.sideShort, dim && styles.dim]}>{c?.shortName}</Text>
        {reds > 0 ? <View style={styles.redCard} /> : null}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open ${c?.name ?? 'team'}`} style={styles.side}>
      <View style={[styles.badgeRing, { shadowColor: color, borderColor: withAlpha(color, 0.35) }]}>
        <CompetitorBadge id={entry.competitorId} size={54} />
      </View>
      <View style={styles.nameRow}>
        <Text style={[styles.sideName, dim && styles.dim]} numberOfLines={2}>{c?.name}</Text>
        {reds > 0 ? <View style={styles.reds}>{Array.from({ length: reds }, (_, i) => <View key={i} style={styles.redCard} />)}</View> : null}
      </View>
      {record ? <Text style={styles.record} numberOfLines={1}>{record}</Text> : null}
      {entry.note && !finished ? (
        <View style={[styles.notePill, { borderColor: withAlpha(color, 0.5) }]}>
          {entry.note === 'Serving' ? <View style={styles.ball} /> : null}
          <Text style={styles.note}>{entry.note}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Watching({ count }: { count: number }) {
  return (
    <View style={styles.watching} accessibilityLabel={`${count} fans watching on Stands`}>
      <Icon name="eye" size={12} color={colors.textDim} />
      <Text style={styles.watchingText}>{crowdLabel(count)} watching</Text>
    </View>
  );
}

function ClockPill({ label, live, tone }: { label: string; live: boolean; tone: 'live' | 'final' | 'break' | 'default' }) {
  return (
    <View style={[styles.clock, tone === 'live' && styles.clockLive, tone === 'break' && styles.clockBreak, tone === 'final' && styles.clockFinal]}
      accessibilityLiveRegion={live ? 'polite' : 'none'}>
      {tone === 'live' ? <LiveDot size={6} /> : null}
      <Text style={[styles.clockText, tone === 'live' && styles.clockTextLive, tone === 'break' && { color: colors.accent }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const BREAKS = /half-time|intermission|quarter-time|three-quarter|end of|innings break|between rounds|walkouts|^mid |^end /i;

export function EventHeader({ state, compact = false }: { state: EventState; compact?: boolean }) {
  const live = state.status === 'live';
  // Tick every second while live so clocks and crowds move between data refreshes.
  const now = useNow(live ? 1000 : 30_000);
  const { meta } = state;
  const sport = sportById(meta.sportId);
  const comp = getWorld().competitionById.get(meta.competitionId);
  const watchers = watchersFor(state, now);

  if (meta.format === 'race') {
    return <RaceHeader state={state} compact={compact} now={now} watchers={watchers} sportName={sport?.name ?? ''} compName={comp?.name ?? ''} />;
  }

  const home = state.entries.find((e) => e.role === 'home');
  const away = state.entries.find((e) => e.role === 'away');
  if (!home || !away) return null;
  const finished = state.status === 'finished';
  const scheduled = state.status === 'scheduled';
  const [homeColor, awayColor] = sideColors(home.competitorId, away.competitorId);
  const clock = live ? liveClock(meta, now) ?? state.periodLabel ?? 'LIVE' : null;
  const isBreak = !!clock && BREAKS.test(clock);
  // Tennis shows the games big already, so the pill only needs "Set 2".
  const statusText = live ? (meta.sportId === 'tennis' && clock ? clock.split(' · ')[0] : clock ?? 'LIVE')
    : finished ? (['soccer', 'rugby_union', 'rugby_league', 'aussie_rules', 'netball'].includes(meta.sportId) ? 'Full time' : 'Final')
      : state.status === 'postponed' ? 'Postponed' : state.status === 'cancelled' ? 'Cancelled' : formatTime(meta.startsAt);
  const innings = meta.format === 'innings';

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <TeamGlow left={homeColor} right={awayColor} strength={compact ? 0.22 : 0.34} />
      {!compact && (
        <View style={styles.topRow}>
          <Icon name={sportIcon(meta.sportId)} size={13} color={colors.textDim} />
          <Text style={styles.comp} numberOfLines={1}>{comp?.name ?? sport?.name}</Text>
          {state.status !== 'postponed' && state.status !== 'cancelled' && watchers > 0 ? <Watching count={watchers} /> : null}
        </View>
      )}

      <View style={[styles.scoreRow, compact && styles.scoreRowCompact]}>
        <Side entry={home} align="left" compact={compact} finished={finished} color={homeColor} now={now} reds={redsOf(state)[0]} />
        <View style={[styles.center, compact && styles.centerCompact]}>
          {scheduled ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.kickoff, compact && { fontSize: 22 }]}>{formatTime(meta.startsAt)}</Text>
              {!compact && <Text style={styles.until}>{formatDay(meta.startsAt)} · {timeUntil(meta.startsAt, now)}</Text>}
            </View>
          ) : meta.sportId === 'tennis' && !finished ? (
            <View style={styles.scores}>
              <FlashScore value={lastGames(home)} style={[styles.big, compact && styles.bigCompact]} />
              <Text style={[styles.dash, compact && { fontSize: 22 }]}>–</Text>
              <FlashScore value={lastGames(away)} style={[styles.big, compact && styles.bigCompact]} />
            </View>
          ) : home.score === null && away.score === null ? (
            <Text style={[styles.vsBig, compact && { fontSize: 22 }]} numberOfLines={1}>
              {finished ? (state.entries.find((e) => e.isWinner)?.scoreText ?? 'W').replace(/^W · /, '') : 'VS'}
            </Text>
          ) : innings ? (
            <View style={styles.inningsCenter}>
              <InningsScore entry={home} finished={finished} compact={compact} />
              <Text style={styles.vsSmall}>v</Text>
              <InningsScore entry={away} finished={finished} compact={compact} />
            </View>
          ) : (
            <View style={styles.scores}>
              <FlashScore value={String(home.score ?? 0)} style={[styles.big, compact && styles.bigCompact, finished && home.isWinner === false && styles.dim]} />
              <Text style={[styles.dash, compact && { fontSize: 22 }]}>–</Text>
              <FlashScore value={String(away.score ?? 0)} style={[styles.big, compact && styles.bigCompact, finished && away.isWinner === false && styles.dim]} />
            </View>
          )}
          {!compact && meta.sportId === 'tennis' && !scheduled ? (
            <Text style={styles.sub}>{finished ? setScores(home, away) : `Sets ${home.score ?? 0}-${away.score ?? 0}`}</Text>
          ) : !compact && !innings && home.score !== null && home.scoreText && away.scoreText && !scheduled ? (
            <Text style={styles.sub}>{home.scoreText}  ·  {away.scoreText}</Text>
          ) : null}
          {(!compact || live) && !scheduled ? (
            <ClockPill label={statusText} live={live} tone={live ? (isBreak ? 'break' : 'live') : finished ? 'final' : 'default'} />
          ) : null}
        </View>
        <Side entry={away} align="right" compact={compact} finished={finished} color={awayColor} now={now} reds={redsOf(state)[1]} />
      </View>

      {!compact && <Scorers state={state} />}
      {finished && state.resultText && !compact ? <Text style={styles.result} numberOfLines={1}>{state.resultText}</Text> : null}
      {!compact && live ? <LiveWinProb state={state} homeColor={homeColor} awayColor={awayColor} /> : null}
    </View>
  );
}

/** Games in the set being played: the last number of "6 3 2". */
function lastGames(e: EntryState): string {
  return (e.scoreText ?? '0').split(' ').pop() ?? '0';
}

/** "6-4 3-6 7-5" from both players' set lists. */
function setScores(home: EntryState, away: EntryState): string {
  const h = (home.scoreText ?? '').split(' ');
  const a = (away.scoreText ?? '').split(' ');
  return h.map((g, i) => `${g}-${a[i] ?? 0}`).join('  ');
}

function redsOf(state: EventState): [number, number] {
  return state.meta.sportId === 'soccer' ? redCardsFor(state) : [0, 0];
}

function InningsScore({ entry, finished, compact }: { entry: EntryState; finished: boolean; compact: boolean }) {
  const text = entry.scoreText ?? '';
  const m = /^(\S+)\s*(\(.*\))?$/.exec(text);
  const main = m?.[1] ?? (text || '–');
  const overs = m?.[2] ?? '';
  const dim = finished && entry.isWinner === false;
  return (
    <View style={{ alignItems: 'center' }}>
      <FlashScore value={main === 'Yet' ? '–' : main} style={[styles.inningsBig, compact && { fontSize: 20 }, dim && styles.dim]} />
      {!compact && overs ? <Text style={styles.overs}>{overs.replace(/[()]/g, '')}</Text> : null}
      {!compact && main === 'Yet' ? <Text style={styles.overs}>Yet to bat</Text> : null}
    </View>
  );
}

function Scorers({ state }: { state: EventState }) {
  const [h, a] = useMemo(() => scorersFor(state), [state]);
  if (h.length === 0 && a.length === 0) return null;
  const home = groupScorers(h).slice(-4);
  const away = groupScorers(a).slice(-4);
  return (
    <View style={styles.scorers} accessibilityLabel={`Scorers: ${[...home, ...away].join('; ')}`}>
      <View style={styles.scorerCol}>{home.map((s) => <Text key={s} style={styles.scorer} numberOfLines={1}>{s}</Text>)}</View>
      <Text style={styles.scorerIcon}>{SCORER_ICON[state.meta.sportId] ?? '•'}</Text>
      <View style={[styles.scorerCol, { alignItems: 'flex-end' }]}>{away.map((s) => <Text key={s} style={[styles.scorer, { textAlign: 'right' }]} numberOfLines={1}>{s}</Text>)}</View>
    </View>
  );
}

function LiveWinProb({ state, homeColor, awayColor }: { state: EventState; homeColor: string; awayColor: string }) {
  const prob = useMemo(() => eventWinProbability(state), [state]);
  if (!prob) return null;
  const [homeId, awayId] = state.meta.competitorIds;
  return (
    <View style={styles.prob}>
      <WinProbBar prob={prob} homeId={homeId} awayId={awayId} homeColor={homeColor} awayColor={awayColor}
        draws={sportHasDraws(state.meta.sportId)} label={state.status === 'live' ? 'Live win probability' : 'Win probability'} />
    </View>
  );
}

// ---------- Races, golf and cycling ----------

function RaceHeader({ state, compact, now, watchers, sportName, compName }: {
  state: EventState; compact: boolean; now: number; watchers: number; sportName: string; compName: string;
}) {
  const { meta } = state;
  const motor = hasTrackMap(meta.sportId);
  const snap = useMemo(() => (motor ? raceSnapshot(meta, now) : null), [motor, meta, now]);
  const live = state.status === 'live';
  const top = useMemo(() => {
    if (snap) return snap.cars.slice(0, 3).map((c) => ({ id: c.competitorId, sub: c.gap === 'Leader' ? (snap.phase === 'grid' || snap.phase === 'formation' ? 'Pole' : 'Leader') : c.gap }));
    return [...state.entries].sort((a, b) => (a.position ?? 99) - (b.position ?? 99)).slice(0, 3)
      .map((e) => ({ id: e.competitorId, sub: e.scoreText ?? '' }));
  }, [snap, state.entries]);
  const leaderColor = teamColor(top[0]?.id);
  const lapText = snap && snap.phase === 'racing' ? `LAP ${snap.currentLap}/${snap.laps}`
    : snap && snap.phase === 'finished' ? 'CHEQUERED FLAG' : snap && snap.phase === 'formation' ? 'FORMATION LAP' : null;
  const statusText = live ? lapText ?? state.periodLabel ?? 'LIVE' : state.status === 'finished' ? 'Final' : state.status === 'scheduled'
    ? `${formatTime(meta.startsAt)} · ${timeUntil(meta.startsAt, now)}` : state.status === 'postponed' ? 'Postponed' : 'Cancelled';

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <TeamGlow left={leaderColor} right={teamColor(top[1]?.id)} strength={compact ? 0.18 : 0.28} />
      {!compact && (
        <View style={styles.topRow}>
          <Icon name={sportIcon(meta.sportId)} size={13} color={colors.textDim} />
          <Text style={styles.comp} numberOfLines={1}>{sportName} · {compName}</Text>
          {watchers > 0 ? <Watching count={watchers} /> : null}
        </View>
      )}
      <View style={styles.raceTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.raceTitle, compact && { fontSize: 20 }]} numberOfLines={compact ? 1 : 2}>{meta.title}</Text>
          {!compact && <Text style={styles.venue} numberOfLines={1}>{meta.venue}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <ClockPill label={statusText} live={live} tone={live ? 'live' : state.status === 'finished' ? 'final' : 'default'} />
          {snap?.safetyCar ? <View style={styles.sc}><Text style={styles.scText}>SAFETY CAR</Text></View> : null}
        </View>
      </View>
      {!compact && live && !snap && state.periodLabel ? <Text style={styles.chase}>{state.periodLabel}</Text> : null}
      <View style={[styles.podium, compact && { gap: space.md }]}>
        {top.map((t, i) => (
          <View key={t.id} style={[styles.podiumItem, !compact && i === 0 && { borderColor: withAlpha(teamColor(t.id), 0.6) }, compact && styles.podiumItemCompact]}>
            <Text style={[styles.podiumPos, i === 0 && { color: colors.gold }]}>P{i + 1}</Text>
            <CompetitorBadge id={t.id} size={compact ? 20 : 30} />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.podiumName} numberOfLines={1}>{compact ? competitorById(t.id)?.shortName : competitorById(t.id)?.name.split(' ').slice(-1)[0]}</Text>
              {!compact && t.sub ? <Text style={styles.podiumSub} numberOfLines={1}>{t.sub}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      {live ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%`, backgroundColor: snap?.safetyCar ? colors.accent : colors.live }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: space.lg,
    paddingTop: space.md, paddingBottom: space.md, gap: space.sm, overflow: 'hidden' },
  wrapCompact: { paddingTop: space.sm, paddingBottom: space.sm, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  comp: { ...type.caps, fontSize: 12, color: colors.textDim, flex: 1 },
  watching: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 3 },
  watchingText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-start' },
  scoreRowCompact: { alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 4 },
  badgeRing: { borderRadius: 40, padding: 4, borderWidth: 1, shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  sideName: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, textAlign: 'center', lineHeight: 18 },
  record: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, letterSpacing: 0.3 },
  notePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  ball: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D8F24B' },
  note: { fontFamily: fonts.bold, fontSize: 11, color: colors.accent, letterSpacing: 0.6, textTransform: 'uppercase' },
  reds: { flexDirection: 'row', gap: 2 },
  redCard: { width: 8, height: 11, borderRadius: 1.5, backgroundColor: '#E5202E' },
  sideCompact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideCompactRight: { flexDirection: 'row-reverse' },
  sideShort: { fontFamily: fonts.heavy, fontSize: 17, color: colors.text, letterSpacing: 0.5 },
  center: { alignItems: 'center', minWidth: 128, gap: 4, paddingTop: 6 },
  centerCompact: { minWidth: 110, paddingTop: 0, gap: 2 },
  scores: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  big: { ...type.score, fontSize: 58, lineHeight: 62, color: colors.text },
  bigCompact: { fontSize: 28, lineHeight: 32 },
  dash: { fontFamily: fonts.semibold, fontSize: 34, color: colors.textDim },
  inningsCenter: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inningsBig: { ...type.score, fontSize: 30, lineHeight: 34, color: colors.text },
  overs: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDim },
  vsSmall: { fontFamily: fonts.semibold, fontSize: 16, color: colors.textDim },
  vsBig: { fontFamily: fonts.black, fontSize: 40, lineHeight: 46, color: colors.text, letterSpacing: 1 },
  kickoff: { fontFamily: fonts.heavy, fontSize: 34, color: colors.text },
  until: { ...type.label, color: colors.textDim, marginTop: 2 },
  sub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, fontVariant: ['tabular-nums'] },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.3)', maxWidth: 200 },
  clockLive: { backgroundColor: 'rgba(255,77,94,0.16)', borderWidth: 1, borderColor: 'rgba(255,77,94,0.55)' },
  clockBreak: { backgroundColor: 'rgba(255,182,39,0.14)', borderWidth: 1, borderColor: 'rgba(255,182,39,0.45)' },
  clockFinal: { backgroundColor: 'rgba(255,255,255,0.08)' },
  clockText: { fontFamily: fonts.heavy, fontSize: 15, color: colors.text, letterSpacing: 0.8, fontVariant: ['tabular-nums'], textTransform: 'uppercase' },
  clockTextLive: { color: '#FF8A95' },
  dim: { color: colors.loss },
  scorers: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.xs },
  scorerCol: { flex: 1, gap: 1 },
  scorer: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  scorerIcon: { fontSize: 12, marginTop: 1 },
  chase: { fontFamily: fonts.bold, fontSize: 15, color: colors.accent, textAlign: 'center', letterSpacing: 0.4 },
  result: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textAlign: 'center', letterSpacing: 0.3 },
  prob: { marginTop: 2 },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.pill, overflow: 'hidden', marginTop: 2 },
  fill: { height: 3 },
  raceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  raceTitle: { ...type.display, fontSize: 28, color: colors.text, textTransform: 'uppercase' },
  venue: { ...type.label, color: colors.textDim },
  sc: { backgroundColor: colors.accent, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  scText: { fontFamily: fonts.heavy, fontSize: 12, color: colors.accentInk, letterSpacing: 1 },
  podium: { flexDirection: 'row', gap: space.sm },
  podiumItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  podiumItemCompact: { flex: 0, backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  podiumPos: { fontFamily: fonts.heavy, fontSize: 15, color: colors.textDim },
  podiumName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  podiumSub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDim, fontVariant: ['tabular-nums'] },
});
