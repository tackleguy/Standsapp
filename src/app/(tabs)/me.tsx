// Me: profile, wallet, Gate Check, record, follows, and links to settings and rules.
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { StandCard } from '@/components/cards/StandCard';
import { GateCheckCard } from '@/components/GateCheckCard';
import { MyRankCard } from '@/components/leaderboard/MyRankCard';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, SectionHeading, StatTile } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { competitorById } from '@/data/api';
import { useNow } from '@/hooks/useNow';
import { formatNumber } from '@/lib/format';
import { summarizeRecord } from '@/logic/predictions';
import { SHOWCASE_MAX } from '@/logic/rules';
import { useUserStore, weeklyCloutWon } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

export default function MeScreen() {
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const clout = useUserStore((s) => s.clout);
  const tix = useUserStore((s) => s.tix);
  const cards = useUserStore((s) => s.cards.length);
  const allCards = useUserStore((s) => s.cards);
  const showcaseIds = useUserStore((s) => s.showcase);
  const showcase = showcaseIds.map((id) => allCards.find((c) => c.id === id)).filter((c) => !!c);
  const predictions = useUserStore((s) => s.predictions);
  const ledger = useUserStore((s) => s.ledger);
  const followed = useUserStore((s) => s.followedCompetitors);
  const record = summarizeRecord(predictions);
  const now = useNow(60_000);

  return (
    <Screen>
      <Header title="Me" large right={<Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={styles.gear}><Icon name="settings-outline" size={22} /></Pressable>} />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={styles.profile}>
          <Avatar seed={profile.avatarSeed} name={profile.displayName} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.displayName}</Text>
            <Text style={styles.handle}>@{profile.username}{profile.isGuest ? ' · guest' : ''}</Text>
          </View>
        </View>
        {profile.isGuest ? (
          <View style={styles.guest}>
            <Text style={styles.guestText}>You are browsing as a guest. Create a free account to chat, make Calls, collect cards, and check in daily.</Text>
            <Button label="Create free account" icon="person-add" onPress={() => router.push('/account')} />
          </View>
        ) : null}
        <View style={styles.tiles}>
          <StatTile label="Clout" value={formatNumber(clout)} accent />
          <StatTile label="Tix" value={formatNumber(tix)} />
          <StatTile label="Cards" value={String(cards)} />
        </View>
        <MyRankCard />
        <GateCheckCard />
        <SectionHeading title={`Showcase · ${showcase.length}/${SHOWCASE_MAX}`} right={<Text style={styles.link} onPress={() => router.push('/cards')}>My cards ›</Text>} />
        {showcase.length === 0 ? (
          <Text style={styles.muted}>Pin your best Stand Cards here. Open any card in your collection and tap Showcase.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.follows}>
            {showcase.map((c) => (
              <Pressable key={c.id} onPress={() => router.push({ pathname: '/card/[id]', params: { id: c.id } })} accessibilityRole="button">
                <StandCard competitorId={c.competitorId} rarity={c.rarity} serial={c.serial} width={104}
                  finish={c.finish} eventId={c.eventId} favorite={c.favorite} won={c.wonGame} />
              </Pressable>
            ))}
          </ScrollView>
        )}
        <SectionHeading title="Calls record" right={<Text style={styles.link} onPress={() => router.push('/leaderboard')}>Leaderboards ›</Text>} />
        <View style={styles.tiles}>
          <StatTile label="Made" value={String(record.made)} />
          <StatTile label="Won" value={String(record.won)} />
          <StatTile label="Win rate" value={`${record.winRate}%`} />
          <StatTile label="This week" value={`+${formatNumber(weeklyCloutWon(ledger, now))}`} accent />
        </View>
        <SectionHeading title={`Following · ${followed.length}`} right={<Text style={styles.link} onPress={() => router.push('/follows')}>Edit ›</Text>} />
        {followed.length === 0 ? <Text style={styles.muted}>Follow teams and athletes so they float to the top of Today.</Text> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.follows}>
            {followed.map((id) => (
              <Pressable key={id} onPress={() => router.push({ pathname: '/competitor/[id]', params: { id } })} style={styles.follow} accessibilityRole="button" accessibilityLabel={competitorById(id)?.name}>
                <CompetitorBadge id={id} size={44} />
                <Text style={styles.followName} numberOfLines={1}>{competitorById(id)?.shortName}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <SectionHeading title="More" />
        <LinkRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        <LinkRow icon="shield-checkmark-outline" label="Community rules" onPress={() => router.push('/rules')} />
        <LinkRow icon="lock-closed-outline" label="Privacy policy" onPress={() => router.push('/privacy')} />
        <LinkRow icon="trash-outline" label="Delete account" danger onPress={() => router.push('/settings')} />
      </ScrollView>
    </Screen>
  );
}

function LinkRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surface }]}>
      <Icon name={icon} size={20} color={danger ? colors.live : colors.textDim} />
      <Text style={[styles.linkLabel, danger && { color: colors.live }]}>{label}</Text>
      <Icon name="chevron-forward" size={18} color={colors.loss} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md },
  name: { fontSize: 22, fontWeight: '900', color: colors.text },
  handle: { ...type.label, color: colors.textDim },
  guest: { marginHorizontal: space.lg, padding: space.lg, gap: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,182,39,0.08)', borderWidth: 1, borderColor: 'rgba(255,182,39,0.3)' },
  guestText: { ...type.body, color: colors.text },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.md },
  link: { ...type.label, color: colors.accent },
  muted: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
  follows: { gap: space.md, paddingHorizontal: space.lg },
  follow: { alignItems: 'center', gap: 4, width: 56 },
  followName: { ...type.label, color: colors.textDim, fontSize: 11 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  linkLabel: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '600' },
});
