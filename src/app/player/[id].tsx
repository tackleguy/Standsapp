// A player's Performance in one game, for every sport: fantasy points, the
// stat line, a stat grid, the rating by period, every play they were in, their
// recent games, and their player card.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { GetCardButton } from '@/components/cards/GetCardButton';
import { Impact, PlayMini, RatingChart, StatGrid } from '@/components/players/PerformanceParts';
import { PlayerAvatar } from '@/components/players/PlayerAvatar';
import { scoresBefore, sideResult } from '@/components/players/playText';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LiveDot } from '@/components/ui/LiveDot';
import { SectionHeading, Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, Skeleton } from '@/components/ui/StateViews';
import { competitorById } from '@/data/api';
import { defaultPlayerEvent, performanceTags, playerById, sportStats } from '@/data/playerApi';
import { usePlayerGame, usePlayerLog } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { currentTime, formatDay, formatNumber, formatTime, timeAgo } from '@/lib/format';
import { createRng } from '@/lib/random';
import { fantasyTix, formatPoints } from '@/logic/fantasy';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

const PLAYS_SHOWN = 5;

export default function PlayerScreen() {
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const router = useRouter();
  const id = String(params.id);
  const player = playerById(id);
  const fallback = useMemo(() => (params.event ? null : defaultPlayerEvent(id, currentTime())), [id, params.event]);
  const [chosen, setChosen] = useState<string | null>(null);
  const eventId = chosen ?? params.event ?? fallback;
  const game = usePlayerGame(id, eventId);
  const log = usePlayerLog(id);
  const [allPlays, setAllPlays] = useState(false);

  if (!player) {
    return <Screen><Header title="Performance" back /><EmptyState icon="person" title="Player not found" body="They may have left the league." /></Screen>;
  }
  const team = competitorById(player.teamId);
  const def = sportStats(player.sportId);
  const data = game.data;

  return (
    <Screen>
      <Header title="Performance" subtitle={`${player.name} · ${player.posLabel}`} back
        right={<IconButton icon="share-outline" label="Share" onPress={() => sharePerformance(player.short, data?.headline ?? '')} />} />
      <ScrollView contentContainerStyle={styles.body}>
        {!eventId ? (
          <EmptyState icon="calendar" title="No games this week" body={`${player.short} has no games in the last few days or the next few.`} />
        ) : game.isLoading || !data ? (
          <Skeleton rows={3} height={120} />
        ) : (
          <>
            <View style={styles.top}>
              <PlayerAvatar playerId={player.id} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {player.short} <Text style={styles.fps}>· {formatPoints(data.points)} fps</Text>
                </Text>
                <Text style={styles.headline} numberOfLines={2}>{data.played ? data.headline : 'Did not play'}</Text>
              </View>
              <Impact value={data.rating} big />
            </View>

            <Social playerId={player.id} eventId={data.state.meta.id} points={data.points} startsAt={data.state.meta.startsAt} live={data.state.status === 'live'} />

            {(() => {
              const tags = performanceTags(player.sportId, data.line, data.points);
              return tags.length ? (
                <View style={styles.tags}>{tags.map((t) => <Text key={t} style={styles.tag}>{t}</Text>)}</View>
              ) : null;
            })()}

            <Surface style={styles.card}>
              <Pressable onPress={() => router.push({ pathname: '/event/[id]', params: { id: data.state.meta.id } })} accessibilityRole="button"
                accessibilityLabel={`Open the game: ${data.state.meta.title}`} style={styles.teamRow}>
                <CompetitorBadge id={team?.id ?? player.sideId} size={22} />
                <Text style={styles.teamText} numberOfLines={1}>{team?.name ?? player.name} · {player.pos}</Text>
                <ResultChip state={data.state} sideId={data.sideId} />
                <Icon name="chevron-forward" size={16} color={colors.textDim} />
              </Pressable>
              <Text style={styles.gameTitle} numberOfLines={1}>
                {data.state.meta.title} · {formatDay(data.state.meta.startsAt)}
              </Text>
              {data.state.status === 'scheduled' ? (
                <Text style={styles.note}>Starts {formatDay(data.state.meta.startsAt)} at {formatTime(data.state.meta.startsAt)}. Stats appear once it begins.</Text>
              ) : (
                <StatGrid rows={def.grid(player.pos)} line={data.line} points={data.points} />
              )}
              {data.state.status !== 'scheduled' ? (
                <Text style={styles.note}>
                  {data.state.status === 'live' ? 'So far: ' : ''}{formatPoints(data.points)} fantasy points = {fantasyTix(data.points)} Tix for every {player.short} player card.
                </Text>
              ) : null}
            </Surface>

            <SectionHeading title="Rating breakdown" />
            <Surface>
              {data.periods.length ? (
                <RatingChart labels={data.periods} values={data.periods.map((_, i) => data.periodRatings[i] ?? 0)} />
              ) : <Text style={styles.note}>The breakdown appears once the game is under way.</Text>}
              <Text style={styles.note}>Each bar adds up the plays {player.short} was in during that {periodWord(data.periods)}. Bigger moments count for more.</Text>
            </Surface>

            <SectionHeading title={`Plays · ${data.plays.length}`} right={data.plays.length > PLAYS_SHOWN ? (
              <Pressable onPress={() => setAllPlays(!allPlays)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>{allPlays ? 'Show less' : 'View all'}</Text>
              </Pressable>
            ) : undefined} />
            <PlayList data={data} all={allPlays} onOpen={() => router.push({ pathname: '/event/[id]', params: { id: data.state.meta.id } })} />
          </>
        )}

        <SectionHeading title="Player card" />
        <GetCardButton playerId={player.id} />

        <SectionHeading title="Recent games" />
        {(log.data ?? []).length === 0 ? <Text style={styles.note}>No games in the last few days.</Text> : (log.data ?? []).map((row) => {
          const on = row.meta.id === eventId;
          const opp = row.meta.competitorIds.length === 2 ? competitorById(row.meta.competitorIds.find((c) => c !== player.sideId)) : null;
          const res = sideResult(row.state, player.sideId);
          return (
            <Pressable key={row.meta.id} onPress={() => setChosen(row.meta.id)} accessibilityRole="button"
              accessibilityState={{ selected: on }} accessibilityLabel={`${row.meta.title}, ${formatPoints(row.points)} fantasy points`}
              style={[styles.logRow, on && styles.logOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle} numberOfLines={1}>{opp ? `vs ${opp.name}` : row.meta.title}</Text>
                <Text style={styles.logMeta} numberOfLines={1}>
                  {formatDay(row.meta.startsAt)} · {res.text}{row.state.status !== 'scheduled' && row.headline ? ` · ${row.headline}` : ''}
                </Text>
              </View>
              {row.state.status === 'scheduled' ? <Text style={styles.logMeta}>{formatTime(row.meta.startsAt)}</Text> : (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.logPts}>{formatPoints(row.points)}</Text>
                  <Text style={styles.logMeta}>FPS</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function periodWord(periods: string[]): string {
  const first = periods[0] ?? '';
  if (/^Q\d/.test(first)) return 'quarter';
  if (/^[12]H$/.test(first)) return 'half';
  if (/^P\d/.test(first)) return 'period';
  if (/^Set/.test(first)) return 'set';
  if (/^R\d/.test(first)) return 'round';
  if (/^\d+$/.test(first)) return 'inning';
  if (/inns/i.test(first)) return 'innings';
  return 'stage';
}

function PlayList({ data, all, onOpen }: { data: NonNullable<ReturnType<typeof usePlayerGame>['data']>; all: boolean; onOpen: () => void }) {
  const before = useMemo(() => scoresBefore(data.state.plays), [data.state.plays]);
  if (data.plays.length === 0) {
    return <Text style={styles.note}>{data.state.status === 'scheduled' ? 'Plays appear here once the game starts.' : 'No plays featuring this player yet.'}</Text>;
  }
  const shown = all ? data.plays : data.plays.slice(0, PLAYS_SHOWN);
  return (
    <View>
      {shown.map((p) => <PlayMini key={p.id} play={p} state={data.state} scoreBefore={before.get(p.id)} onPress={onOpen} />)}
    </View>
  );
}

function ResultChip({ state, sideId }: { state: Parameters<typeof sideResult>[0]; sideId: string }) {
  const r = sideResult(state, sideId);
  const color = r.tone === 'win' ? colors.win : r.tone === 'live' ? colors.live : r.tone === 'loss' ? colors.down : colors.textDim;
  return (
    <View style={styles.result}>
      {r.tone === 'live' ? <LiveDot /> : null}
      <Text style={[styles.resultText, { color }]} numberOfLines={1}>{r.text}</Text>
    </View>
  );
}

/** Simulated fan reactions to the performance (the crowd is simulated in the demo). */
function Social({ playerId, eventId, points, startsAt, live }: { playerId: string; eventId: string; points: number; startsAt: number; live: boolean }) {
  const now = useNow(30_000);
  const rng = createRng(`perf:${playerId}:${eventId}`);
  const heat = Math.max(0.05, Math.min(3, points / 12));
  const age = Math.min(1, Math.max(0.05, (now - startsAt) / (4 * 3_600_000)));
  const reacts = Math.round(rng.int(40, 320) * heat * age);
  const comments = Math.round(reacts * rng.float(0.4, 1.4));
  const shares = Math.round(reacts * rng.float(0.01, 0.05));
  const views = Math.round(reacts * rng.float(90, 220));
  return (
    <View style={styles.social}>
      <View style={styles.socialRow}>
        <Text style={styles.socialItem}>😀 {formatNumber(reacts, true)}</Text>
        <Text style={styles.socialItem}>💬 {formatNumber(comments, true)}</Text>
        <Text style={styles.socialItem}>↗ {formatNumber(shares, true)}</Text>
      </View>
      <Text style={styles.socialMeta}>{live ? 'Live now' : timeAgo(startsAt, now)} · 👁 {formatNumber(views, true)}</Text>
    </View>
  );
}

async function sharePerformance(name: string, line: string) {
  const { Share } = await import('react-native');
  try {
    await Share.share({ message: `${name}: ${line} — on Stands` });
  } catch {
    // Sharing is optional.
  }
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingBottom: 60, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  fps: { color: colors.win, fontWeight: '800' },
  headline: { fontFamily: fonts.heavy, fontSize: 30, color: colors.text, lineHeight: 34 },
  social: { gap: 4 },
  socialRow: { flexDirection: 'row', gap: space.lg },
  socialItem: { ...type.label, fontSize: 14, color: colors.text },
  socialMeta: { ...type.label, color: colors.textDim },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { ...type.label, fontSize: 13, color: colors.accent, backgroundColor: 'rgba(255,182,39,0.12)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, overflow: 'hidden' },
  card: { gap: space.md },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  teamText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  gameTitle: { ...type.label, color: colors.textDim, marginTop: -6 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultText: { fontFamily: fonts.heavy, fontSize: 16, fontVariant: ['tabular-nums'] },
  note: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
  link: { ...type.label, color: colors.accent, fontSize: 13 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, minHeight: 56 },
  logOn: { borderColor: colors.accent },
  logTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  logMeta: { ...type.label, color: colors.textDim, marginTop: 2 },
  logPts: { fontFamily: fonts.heavy, fontSize: 20, color: colors.win },
});
