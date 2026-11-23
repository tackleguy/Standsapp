// A fan's profile: tier, standings, form, favourite teams, and recent Calls.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { FanAvatar, TierBadge } from '@/components/leaderboard/TierBadge';
import { Button } from '@/components/ui/Button';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { SectionHeading, StatTile } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import type { FanCall } from '@/data/demo/fanProfile';
import { countdown, PERIODS } from '@/data/demo/ranking';
import { useNow } from '@/hooks/useNow';
import { useFanProfile } from '@/hooks/useRanking';
import { formatNumber, timeAgo } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

export default function FanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useFanProfile(String(id));
  const now = useNow(30_000);
  const following = useUserStore((s) => (s.followedFans ?? []).includes(String(id)));
  const toggle = useUserStore((s) => s.toggleFan);

  if (profile.isLoading) return <Screen><Header title="Loading…" back /><Skeleton rows={4} /></Screen>;
  if (profile.isError) return <Screen><Header title="Fan" back /><ErrorState onRetry={() => profile.refetch()} /></Screen>;
  const p = profile.data;
  if (!p) return <Screen><Header title="Fan" back /><EmptyState icon="person" title="Fan not found" body="They may have left Stands." /></Screen>;
  const { fan } = p;
  const sport = sportById(fan.favoriteSportId);
  const since = new Date(p.joinedAt).toLocaleDateString([], { month: 'short', year: 'numeric' });

  const onFollow = () => {
    tapLight();
    toggle(fan.id);
    toast(following ? `Unfollowed @${fan.username}` : `Following @${fan.username}. They are on your Following board now.`, following ? 'info' : 'success');
  };

  return (
    <Screen>
      <Header title={`@${fan.username}`} subtitle="Fan profile" back />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={styles.hero}>
          <FanAvatar seed={fan.avatarSeed} name={fan.displayName} size={92} tier={p.tier} />
          <Text style={styles.name} numberOfLines={1}>{fan.displayName}</Text>
          <View style={styles.metaRow}>
            <TierBadge tier={p.tier} size="lg" />
            {sport ? (
              <View style={styles.sportPill}>
                <Icon name={sportIcon(sport.id)} size={13} color={colors.text} />
                <Text style={styles.sportText}>{sport.name}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.since}>On Stands since {since} · tier locks again in {countdown(p.tiersUpdateAt - now)}</Text>
          <Button label={following ? 'Following' : 'Follow'} icon={following ? 'checkmark-circle' : 'person-add'}
            variant={following ? 'secondary' : 'primary'} onPress={onFollow} style={{ minWidth: 190, marginTop: space.sm }} />
        </View>

        <SectionHeading title="Leaderboards" right={<Text style={styles.link} onPress={() => router.push('/leaderboard')}>See all ›</Text>} />
        <View style={styles.standings}>
          {p.standings.map((s) => (
            <View key={s.period} style={styles.standing}>
              <Text style={styles.standLabel}>{PERIODS.find((x) => x.id === s.period)?.label}</Text>
              <Text style={[styles.standRank, s.rank !== null && s.rank <= 100 && { color: colors.accent },
                s.rank !== null && s.rank >= 10_000 && { fontSize: 21 }]} numberOfLines={1}>
                {s.rank === null ? '–' : `#${formatNumber(s.rank)}`}
              </Text>
              <Text style={styles.standOf} numberOfLines={1}>{s.rank === null ? 'not ranked yet' : `of ${formatNumber(s.ranked)}`}</Text>
              <Text style={styles.standScore}>+{formatNumber(s.score)}</Text>
            </View>
          ))}
        </View>

        <SectionHeading title="Calls record" />
        <View style={styles.tiles}>
          <StatTile label="Made" value={formatNumber(p.callsMade)} />
          <StatTile label="Win rate" value={`${p.winRate}%`} />
          <StatTile label="Best run" value={String(p.bestStreak)} />
          <StatTile label="Streak" value={p.streak > 0 ? `🔥${p.streak}` : '0'} accent={p.streak >= 3} />
        </View>

        {p.favoriteTeams.length > 0 ? (
          <>
            <SectionHeading title="Rides with" />
            <View style={styles.teams}>
              {p.favoriteTeams.map((tid) => (
                <Pressable key={tid} onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: tid } })} style={styles.team}
                  accessibilityRole="button" accessibilityLabel={competitorById(tid)?.name}>
                  <CompetitorBadge id={tid} size={36} />
                  <Text style={styles.teamName} numberOfLines={1}>{competitorById(tid)?.name}</Text>
                  <Icon name="chevron-forward" size={16} color={colors.loss} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <SectionHeading title="Recent Calls" />
        {p.recentCalls.length === 0 ? (
          <Text style={styles.muted}>No settled Calls in the last two days.</Text>
        ) : p.recentCalls.map((c) => <CallRow key={c.id} call={c} now={now} onPress={() => router.push({ pathname: '/event/[id]', params: { id: c.eventId } })} />)}
      </ScrollView>
    </Screen>
  );
}

function CallRow({ call, now, onPress }: { call: FanCall; now: number; onPress: () => void }) {
  const won = call.outcome === 'won';
  const lost = call.outcome === 'lost';
  const tone = won ? colors.win : lost ? colors.down : colors.textDim;
  const label = won ? `WON +${formatNumber(call.payout - call.stake)}` : lost ? `LOST −${formatNumber(call.stake)}` : 'REFUNDED';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.call, pressed && { backgroundColor: colors.surface }]} accessibilityRole="button"
      accessibilityLabel={`${call.eventTitle}. ${call.question} Picked ${call.pick}. ${label}`}>
      <View style={styles.callIcon}><Icon name={sportIcon(call.sportId)} size={16} color={colors.textDim} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.callTitle} numberOfLines={1}>{call.eventTitle}</Text>
        <Text style={styles.callQ} numberOfLines={1}>{call.question}</Text>
        <Text style={styles.callPick} numberOfLines={1}>Picked <Text style={{ color: colors.text }}>{call.pick}</Text> · {call.stake} at ×{call.multiplier.toFixed(2)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={[styles.result, { color: tone, borderColor: tone }]}>{label}</Text>
        <Text style={styles.ago}>{timeAgo(call.settledAt, now)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingHorizontal: space.lg, paddingTop: space.md },
  name: { ...type.display, fontSize: 32, color: colors.text, textTransform: 'uppercase', marginTop: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sportPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh },
  sportText: { ...type.label, color: colors.text },
  since: { ...type.label, fontSize: 11, color: colors.textDim, textAlign: 'center' },
  link: { ...type.label, color: colors.accent },
  standings: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  standing: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: 1 },
  standLabel: { ...type.caps, fontSize: 12, color: colors.textDim },
  standRank: { fontFamily: fonts.black, fontSize: 26, color: colors.text, fontVariant: ['tabular-nums'] },
  standOf: { ...type.label, fontSize: 10, color: colors.loss },
  standScore: { fontFamily: fonts.bold, fontSize: 15, color: colors.win, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  teams: { paddingHorizontal: space.lg, gap: space.sm },
  team: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line },
  teamName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
  call: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  callIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  callTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  callQ: { ...type.label, fontSize: 11, color: colors.textDim, letterSpacing: 0.2 },
  callPick: { ...type.label, fontSize: 11, color: colors.loss, letterSpacing: 0.2 },
  result: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  ago: { ...type.label, fontSize: 10, color: colors.loss },
});
