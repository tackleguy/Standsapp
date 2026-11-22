// A team or athlete: follow them, see their recent results, upcoming events, and roster.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { ScoreCard } from '@/components/event/ScoreCard';
import { toCardEvent } from '@/components/event/toCardEvent';
import { Button } from '@/components/ui/Button';
import { DemoTag, SectionHeading, StatTile } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { useCompetitor } from '@/hooks/useLiveData';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

export default function CompetitorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const page = useCompetitor(String(id));
  const followed = useUserStore((s) => s.followedCompetitors);
  const toggle = useUserStore((s) => s.toggleCompetitor);
  const myCards = useUserStore((s) => s.cards.filter((c) => c.competitorId === id).length);

  if (page.isLoading) return <Screen><Header title="Loading…" back /><Skeleton rows={4} /></Screen>;
  if (page.isError) return <Screen><Header title="Team" back /><ErrorState onRetry={() => page.refetch()} /></Screen>;
  const data = page.data;
  if (!data) return <Screen><Header title="Not found" back /><EmptyState icon="help-circle" title="We could not find that team or athlete" /></Screen>;

  const { competitor: c, team, roster, recent, upcoming, record, competition } = data;
  const isFollowed = followed.includes(c.id);
  const followedSet = new Set(followed);
  const open = (eventId: string) => router.push({ pathname: '/event/[id]', params: { id: eventId } });

  return (
    <Screen>
      <Header title={c.name} subtitle={sportById(c.sportId)?.name} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={styles.hero}>
          <CompetitorBadge id={c.id} size={96} />
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.sub}>{c.kind === 'team' ? `${c.home} · ${competition?.name ?? ''}` : `${c.home}${team ? ` · ${team.name}` : ''}`}</Text>
          <DemoTag />
          <Button label={isFollowed ? 'Following' : 'Follow'} icon={isFollowed ? 'star' : 'star-outline'} variant={isFollowed ? 'secondary' : 'primary'}
            onPress={() => toggle(c.id)} style={{ minWidth: 180, marginTop: space.sm }} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="Last 3 days" value={`${record.won}-${record.played - record.won}`} />
          <StatTile label="Win rate" value={record.played ? `${Math.round((record.won / record.played) * 100)}%` : '–'} />
          <StatTile label="Your cards" value={String(myCards)} accent />
        </View>
        {team ? (
          <Pressable onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: team.id } })} style={styles.teamRow} accessibilityRole="button">
            <CompetitorBadge id={team.id} size={32} />
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ) : null}
        <SectionHeading title="Coming up" />
        {upcoming.length === 0 ? <Text style={styles.muted}>Nothing scheduled in the next three days.</Text>
          : upcoming.map((s) => <ScoreCard key={s.meta.id} event={toCardEvent(s, followedSet)} onPress={() => open(s.meta.id)} />)}
        <SectionHeading title="Recent results" />
        {recent.length === 0 ? <Text style={styles.muted}>No results in the last three days.</Text>
          : recent.map((s) => <ScoreCard key={s.meta.id} event={toCardEvent(s, followedSet)} onPress={() => open(s.meta.id)} />)}
        {roster.length > 0 ? (
          <>
            <SectionHeading title="Roster" />
            {roster.map((r) => (
              <Pressable key={r.id} onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: r.id } })} style={styles.teamRow} accessibilityRole="button">
                <CompetitorBadge id={r.id} size={32} />
                <Text style={styles.teamName}>{r.name}</Text>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, padding: space.lg },
  name: { fontSize: 26, fontWeight: '900', color: colors.text, textAlign: 'center' },
  sub: { ...type.label, color: colors.textDim, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  teamName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  chev: { fontSize: 20, color: colors.loss },
  muted: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
});
