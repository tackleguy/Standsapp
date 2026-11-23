// A team or athlete: their season at a glance (position, record, form, mini table),
// follow them, upcoming events, recent results, and roster.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { ScoreCard } from '@/components/event/ScoreCard';
import { toCardEvent } from '@/components/event/toCardEvent';
import { ChampionshipTable, FormStrip, TeamTable } from '@/components/standings/StandingsTable';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading, StatTile } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { TeamGlow } from '@/components/ui/TeamGlow';
import { sportById } from '@/config/sports';
import {
  championship, championshipRow, fightRecord, leagueName, ordinal, standingsKind, teamRow, teamTable, venueFor,
} from '@/data/api';
import type { Competitor } from '@/data/types';
import { useCompetitor } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

interface Tile { label: string; value: string; accent?: boolean }

/** The headline numbers for this competitor's season, by sport shape. */
function seasonSummary(c: Competitor, now: number) {
  const kind = standingsKind(c.sportId);
  if (kind === 'table' || kind === 'pct') {
    const r = teamRow(c.id, now);
    if (!r) return null;
    const tiles: Tile[] = [
      { label: 'Position', value: ordinal(r.position), accent: r.position <= 3 },
      { label: 'Record', value: r.drawn > 0 ? `${r.won}-${r.drawn}-${r.lost}` : `${r.won}-${r.lost}` },
      kind === 'pct' ? { label: 'Win %', value: r.pct.toFixed(3).replace(/^0/, '') } : { label: 'Points', value: String(r.points) },
      { label: 'Streak', value: r.streak },
    ];
    return { tiles, form: r.form, headline: `${ordinal(r.position)} in the ${leagueName(c.sportId)}` };
  }
  if (kind === 'championship') {
    const r = championshipRow(c.id, now);
    if (!r) return null;
    const tiles: Tile[] = [
      { label: 'Standing', value: `P${r.position}`, accent: r.position <= 3 },
      { label: 'Points', value: String(r.points) },
      { label: 'Wins', value: String(r.wins) },
      { label: 'Podiums', value: String(r.podiums) },
    ];
    return { tiles, form: null, headline: `P${r.position} in the ${leagueName(c.sportId)}` };
  }
  if (c.kind !== 'athlete') return null;
  const r = fightRecord(c);
  const tiles: Tile[] = [
    { label: 'Record', value: `${r.won}-${r.lost}-${r.drawn}`, accent: true },
    { label: 'Finishes', value: String(r.finishes) },
    { label: 'Ranking', value: r.ranking === 1 ? 'Champ' : r.ranking ? `#${r.ranking - 1}` : 'NR' },
  ];
  return { tiles, form: null, headline: r.ranking === 1 ? `${leagueName(c.sportId)} champion` : leagueName(c.sportId) };
}

export default function CompetitorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const now = useNow(60_000);
  const page = useCompetitor(String(id));
  const followed = useUserStore((s) => s.followedCompetitors);
  const toggle = useUserStore((s) => s.toggleCompetitor);
  const myCards = useUserStore((s) => s.cards.filter((c) => c.competitorId === id).length);
  const followedSet = useMemo(() => new Set(followed), [followed]);
  const competitor = page.data?.competitor;
  const summary = useMemo(() => (competitor ? seasonSummary(competitor, now) : null), [competitor, now]);

  if (page.isLoading) return <Screen><Header title="Loading…" back /><Skeleton rows={4} /></Screen>;
  if (page.isError) return <Screen><Header title="Team" back /><ErrorState onRetry={() => page.refetch()} /></Screen>;
  const data = page.data;
  if (!data) return <Screen><Header title="Not found" back /><EmptyState icon="help-circle" title="We could not find that team or athlete" /></Screen>;

  const { competitor: c, team, roster, recent, upcoming, record } = data;
  const isFollowed = followed.includes(c.id);
  const open = (eventId: string) => router.push({ pathname: '/event/[id]', params: { id: eventId } });
  const openCompetitor = (cid: string) => router.push({ pathname: '/competitor/[id]', params: { id: cid } });
  const openTable = () => router.push({ pathname: '/standings/[sportId]', params: { sportId: c.sportId } });
  const tableKind = standingsKind(c.sportId);
  const tiles: Tile[] = summary?.tiles ?? [
    { label: 'Last 3 days', value: `${record.won}-${record.played - record.won}` },
    { label: 'Win rate', value: record.played ? `${Math.round((record.won / record.played) * 100)}%` : '–' },
  ];
  // A second colour that is not plain white gives the glow some depth.
  const glowRight = c.colors && c.colors[1] !== '#FFFFFF' ? c.colors[1] : c.colors?.[0];

  return (
    <Screen>
      <Header title={c.name} subtitle={sportById(c.sportId)?.name} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={styles.hero}>
          <TeamGlow id={`comp-${c.id}`} left={c.colors?.[0]} right={glowRight} strength={0.45} />
          <CompetitorBadge id={c.id} size={92} />
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.sub}>{c.kind === 'team' && !roster.length ? `${c.home} · ${venueFor(c)}` : `${c.home}${team ? ` · ${team.name}` : ''}`}</Text>
          {summary?.headline ? (
            <Pressable onPress={tableKind === 'record' ? undefined : openTable} disabled={tableKind === 'record'}
              accessibilityRole="button" style={styles.headline}>
              <Icon name="podium" size={14} color={colors.accent} />
              <Text style={styles.headlineText}>{summary.headline}</Text>
            </Pressable>
          ) : null}
          {summary?.form && summary.form.length > 0 ? (
            <View style={styles.formBox}><Text style={styles.formLabel}>FORM</Text><FormStrip form={summary.form} size={22} /></View>
          ) : null}
          <Button label={isFollowed ? 'Following' : 'Follow'} icon={isFollowed ? 'star' : 'star-outline'} variant={isFollowed ? 'secondary' : 'primary'}
            onPress={() => toggle(c.id)} style={{ minWidth: 180, marginTop: space.sm }} />
        </View>

        <View style={styles.tiles}>
          {tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} accent={t.accent} />)}
        </View>
        {myCards > 0 ? (
          <Pressable onPress={() => router.push('/cards')} style={styles.cardsRow} accessibilityRole="button">
            <Icon name="albums" size={16} color={colors.accent} />
            <Text style={styles.cardsText}>You own {myCards} Stand Card{myCards === 1 ? '' : 's'} of {c.name}</Text>
            <Icon name="chevron-forward" size={16} color={colors.textDim} />
          </Pressable>
        ) : null}

        {team ? (
          <Pressable onPress={() => openCompetitor(team.id)} style={styles.teamRow} accessibilityRole="button">
            <CompetitorBadge id={team.id} size={32} />
            <Text style={styles.teamName}>{team.name}</Text>
            <Icon name="chevron-forward" size={18} color={colors.loss} />
          </Pressable>
        ) : null}

        {tableKind === 'table' || tableKind === 'pct' ? (
          <>
            <SectionHeading title={leagueName(c.sportId)} right={<Text style={styles.link} onPress={openTable}>Full table ›</Text>} />
            <View style={styles.tableCard}>
              <TeamTable sportId={c.sportId} kind={tableKind} rows={teamTable(c.sportId, now)} highlight={new Set([c.id])}
                around={{ id: c.id, radius: 2 }} onPress={openCompetitor} showZones={false} />
            </View>
          </>
        ) : tableKind === 'championship' && c.kind === 'athlete' ? (
          <>
            <SectionHeading title="Championship" right={<Text style={styles.link} onPress={openTable}>Standings ›</Text>} />
            <View style={styles.tableCard}>
              <ChampionshipTable rows={championship(c.sportId, now)} highlight={new Set([c.id])} limit={5} onPress={openCompetitor} />
            </View>
          </>
        ) : null}

        <SectionHeading title="Coming up" />
        {upcoming.length === 0 ? <Text style={styles.muted}>Nothing scheduled in the next three days.</Text>
          : upcoming.map((s) => <ScoreCard key={s.meta.id} event={toCardEvent(s, followedSet, now)} onPress={() => open(s.meta.id)} />)}
        <SectionHeading title="Recent results" />
        {recent.length === 0 ? <Text style={styles.muted}>No results in the last three days.</Text>
          : recent.map((s) => <ScoreCard key={s.meta.id} event={toCardEvent(s, followedSet, now)} onPress={() => open(s.meta.id)} />)}
        {roster.length > 0 ? (
          <>
            <SectionHeading title={c.sportId === 'cycling' ? 'Riders' : 'Drivers'} />
            {roster.map((r) => {
              const standing = championshipRow(r.id, now);
              return (
                <Pressable key={r.id} onPress={() => openCompetitor(r.id)} style={styles.teamRow} accessibilityRole="button">
                  <CompetitorBadge id={r.id} size={32} />
                  <Text style={styles.teamName}>{r.name}</Text>
                  {standing ? <Text style={styles.rosterStat}>P{standing.position} · {standing.points} pts</Text> : null}
                  <Icon name="chevron-forward" size={18} color={colors.loss} />
                </Pressable>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, padding: space.lg, paddingTop: space.xl, overflow: 'hidden' },
  name: { ...type.display, fontSize: 34, color: colors.text, textAlign: 'center', textTransform: 'uppercase' },
  sub: { ...type.label, color: colors.textDim, textAlign: 'center' },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,14,23,0.55)', paddingHorizontal: space.md,
    paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  headlineText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, letterSpacing: 0.4 },
  formBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  formLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim, letterSpacing: 1 },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  cardsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginTop: space.md, padding: space.md,
    borderRadius: radius.md, backgroundColor: 'rgba(255,182,39,0.08)', borderWidth: 1, borderColor: 'rgba(255,182,39,0.3)' },
  cardsText: { flex: 1, ...type.label, fontSize: 13, color: colors.text },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  teamName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  rosterStat: { fontFamily: fonts.bold, fontSize: 15, color: colors.textDim },
  tableCard: { marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  link: { ...type.label, color: colors.accent },
  muted: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
});
