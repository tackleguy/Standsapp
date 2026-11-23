// Your weekly standing on the Me tab: rank, tier, movement, and progress to the
// next tier. Tapping it opens the leaderboards.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { countdown } from '@/data/demo/ranking';
import { useNow } from '@/hooks/useNow';
import { useBoard, useMeInput } from '@/hooks/useRanking';
import { withAlpha } from '@/lib/color';
import { formatNumber } from '@/lib/format';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Icon } from '../ui/Icon';
import { MovementTag } from './BoardRow';
import { TierBadge, tierColor } from './TierBadge';
import { topShare } from './YouBar';

const GLOBAL = { kind: 'global' } as const;

export function MyRankCard() {
  const router = useRouter();
  const now = useNow(15_000);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const me = useMeInput('week', null, true, now);
  const board = useBoard('week', GLOBAL, me);
  const view = board.data;
  const mine = view?.me;
  const tier = mine?.tier ?? 'bronze';
  const c = tierColor(tier);

  return (
    <Pressable onPress={() => router.push('/leaderboard')} accessibilityRole="button" accessibilityLabel="Open leaderboards"
      style={({ pressed }) => [styles.card, { borderColor: withAlpha(c, 0.5), backgroundColor: withAlpha(c, 0.07) }, pressed && { opacity: 0.85 }]}>
      <View style={styles.top}>
        <Text style={styles.kicker}>This week</Text>
        <TierBadge tier={tier} size="sm" />
        <Icon name="chevron-forward" size={18} color={colors.textDim} />
      </View>
      {isGuest ? (
        <Text style={styles.body}>Create a free account to get ranked against {view ? formatNumber(view.ranked) : 'thousands of'} fans and earn a tier.</Text>
      ) : !view || !mine ? (
        <Text style={styles.body}>Loading your rank…</Text>
      ) : mine.rank === null ? (
        <>
          <Text style={styles.rank}>Unranked</Text>
          <Text style={styles.body}>Win a Call to join {formatNumber(view.ranked)} ranked fans this week.</Text>
        </>
      ) : (
        <>
          <View style={styles.rankRow}>
            <Text style={styles.rank}>#{formatNumber(mine.rank)}</Text>
            <Text style={styles.of}>of {formatNumber(view.ranked)}</Text>
            <MovementTag movement={mine.movement} size={13} />
            <Text style={styles.share}>Top {topShare(mine.rank, view.ranked)}</Text>
          </View>
          {view.next ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(3, Math.round(view.next.progress * 100))}%`, backgroundColor: tierColor(view.next.tier) }]} />
              </View>
              <Text style={styles.body}>{formatNumber(Math.max(1, view.next.score - mine.score))} more Clout won puts you in {view.next.name}.</Text>
            </>
          ) : <Text style={styles.body}>You are on Legend pace. Hold on to it.</Text>}
        </>
      )}
      {view ? <Text style={styles.foot}>Tiers lock in {countdown(view.tiersUpdateAt - now)} · based on Clout won in the last 7 days</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginTop: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1, gap: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kicker: { ...type.caps, color: colors.textDim, flex: 1 },
  rankRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  rank: { fontFamily: fonts.black, fontSize: 40, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 44 },
  of: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textDim },
  share: { fontFamily: fonts.bold, fontSize: 14, color: colors.accent, marginLeft: 'auto', letterSpacing: 0.5 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  body: { ...type.body, fontSize: 14, color: colors.text },
  foot: { ...type.label, fontSize: 10, color: colors.loss, letterSpacing: 0.3 },
});
