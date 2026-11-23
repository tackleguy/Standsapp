// Your place, pinned to the bottom of every leaderboard: rank, tier, and how far
// it is to the next tier.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { countdown, type BoardView, type Period } from '@/data/demo/ranking';
import { formatNumber } from '@/lib/format';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Button } from '../ui/Button';
import { MovementTag } from './BoardRow';
import { FanAvatar, TierBadge, tierColor } from './TierBadge';

const WHEN: Record<Period, string> = { today: 'today', week: 'this week', season: 'this season' };

export function YouBar({ view, isGuest, now, group }: { view: BoardView | undefined; isGuest: boolean; now: number; group: boolean }) {
  const router = useRouter();
  if (isGuest) {
    return (
      <View style={styles.bar}>
        <Text style={styles.prompt}>Create a free account to get ranked and earn a tier.</Text>
        <Button label="Join free" small onPress={() => router.push('/account')} />
      </View>
    );
  }
  const me = view?.me;
  if (!view || !me) return null;
  if (me.rank === null) {
    return (
      <View style={styles.bar}>
        <FanAvatar seed={me.avatarSeed} name={me.displayName} size={34} tier={me.tier} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>You are not ranked {WHEN[view.period]} yet</Text>
          <Text style={styles.prompt}>
            {view.metric === 'tix' ? 'Your cards earn Tix when their teams win.' : 'Win a Call to join'} {view.metric === 'tix' ? `${formatNumber(view.ranked)} collectors are ranked.` : `${formatNumber(view.ranked)} ranked fans.`}
          </Text>
        </View>
        {view.metric === 'tix'
          ? <Button label="Get cards" small onPress={() => router.push('/pack')} />
          : <Button label="Make a Call" small onPress={() => router.push('/calls')} />}
      </View>
    );
  }
  const next = view.next;
  return (
    <Pressable onPress={() => router.push('/me')} style={styles.bar} accessibilityRole="button"
      accessibilityLabel={`You are ranked ${me.rank} of ${view.ranked}`}>
      <View style={styles.rankCol}>
        <Text style={styles.rank} numberOfLines={1}>#{formatNumber(me.rank)}</Text>
        <Text style={styles.of} numberOfLines={1}>of {formatNumber(view.ranked)}</Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={styles.line}>
          <Text style={styles.title}>You</Text>
          <TierBadge tier={me.tier} size="sm" />
          <MovementTag movement={me.movement} />
          <Text style={styles.score}>+{formatNumber(me.score)}{view.metric === 'tix' ? ' Tix' : ''}</Text>
        </View>
        {next && !group ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(3, Math.round(next.progress * 100))}%`, backgroundColor: tierColor(next.tier) }]} />
            </View>
            <Text style={styles.prompt} numberOfLines={1}>
              {formatNumber(Math.max(1, next.score - me.score))} more Clout for {next.name} · tiers lock in {countdown(view.tiersUpdateAt - now)}
            </Text>
          </>
        ) : (
          <Text style={styles.prompt} numberOfLines={1}>
            {group ? `${ordinalWord(me.rank)} of ${view.players} here` : `Top ${topShare(me.rank, view.ranked)} of ${view.metric === 'tix' ? 'collectors' : 'fans'} ${WHEN[view.period]}`}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** "0.4%", "12%", "61%" */
export function topShare(rank: number, ranked: number): string {
  const pct = (rank / Math.max(1, ranked)) * 100;
  return pct < 1 ? `${Math.max(0.1, Math.round(pct * 10) / 10)}%` : `${Math.ceil(pct)}%`;
}

function ordinalWord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: '#1A2232',
    borderWidth: 1, borderColor: 'rgba(255,182,39,0.45)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 10 },
  rankCol: { alignItems: 'center', minWidth: 64 },
  rank: { fontFamily: fonts.black, fontSize: 24, color: colors.accent, fontVariant: ['tabular-nums'] },
  of: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim, letterSpacing: 0.4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  score: { fontFamily: fonts.heavy, fontSize: 18, color: colors.text, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  prompt: { ...type.label, fontSize: 11, color: colors.textDim, letterSpacing: 0.2, flexShrink: 1 },
});
