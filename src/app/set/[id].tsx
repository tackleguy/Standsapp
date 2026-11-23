// A sport's set, shown like a sticker album: every team or athlete has a slot.
// Collect one card of each (any rarity) to finish the set and claim its Tix reward.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { AnyCard } from '@/components/cards/CardFaces';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { SEASON, setMembers } from '@/data/demo/cards';
import type { OwnedCard } from '@/data/types';
import { currentTime } from '@/lib/format';
import { tapError, tapSuccess } from '@/lib/haptics';
import { groupCards, RARITY_ORDER, setProgress } from '@/logic/cards';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

/** The best copy to show in an album slot: rarest, then Holo, then lowest serial. */
function bestForSlot(cards: OwnedCard[]): OwnedCard {
  return [...cards].sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
    || Number(b.finish === 'holo') - Number(a.finish === 'holo') || a.serial - b.serial)[0];
}

export default function SetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cards = useUserStore((s) => s.cards);
  const claimed = useUserStore((s) => s.claimedSets);
  const showcase = useUserStore((s) => s.showcase);
  const claimSet = useUserStore((s) => s.claimSet);
  const sport = sportById(String(id));
  const members = useMemo(() => setMembers(String(id)), [id]);
  const progress = useMemo(() => setProgress(members.map((m) => m.id), cards), [members, cards]);
  const byCompetitor = useMemo(() => {
    const map = new Map<string, OwnedCard[]>();
    for (const c of cards) map.set(c.competitorId, [...(map.get(c.competitorId) ?? []), c]);
    return map;
  }, [cards]);

  if (!sport || members.length === 0) {
    return <Screen><Header title="Set" back /><EmptyState icon="help-circle" title="We could not find that set" /></Screen>;
  }

  const cols = width > 700 ? 5 : 3;
  const cardWidth = Math.floor((Math.min(width, 900) - space.lg * 2 - space.sm * (cols - 1)) / cols);
  const isClaimed = claimed.includes(sport.id);
  const pct = Math.round((progress.owned / progress.total) * 100);

  const claim = () => {
    const r = claimSet(sport.id, currentTime());
    if ('error' in r) { tapError(); toast(r.error, 'error'); return; }
    tapSuccess();
    toast(`${sport.name} set complete! +${r.tix} Tix`, 'success');
  };

  return (
    <Screen>
      <Header title={`${sport.name} ${SEASON}`} subtitle={`Set · ${progress.owned} of ${progress.total} collected`} back />
      <ScrollView contentContainerStyle={styles.body}>
        <Surface style={{ gap: space.sm }}>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%` }, progress.complete && { backgroundColor: colors.win }]} /></View>
          <Text style={styles.lead}>
            {isClaimed ? `Set complete. You collected the ${progress.reward} Tix reward.`
              : progress.complete ? `Every card collected! Claim your ${progress.reward} Tix reward.`
                : `Collect one card of every ${sport.name} team and athlete (any rarity) to win ${progress.reward} Tix. ${progress.total - progress.owned} to go.`}
          </Text>
          {progress.complete && !isClaimed ? <Button label={`Claim ${progress.reward} Tix`} icon="trophy" onPress={claim} /> : null}
          {!progress.complete ? (
            <Button label={`Open a ${sport.name} pack`} icon="gift" variant="secondary"
              onPress={() => router.push({ pathname: '/pack', params: { type: 'standard', sport: sport.id } })} />
          ) : null}
        </Surface>

        <View style={styles.grid}>
          {members.map((m, i) => {
            const mine = byCompetitor.get(m.id);
            if (!mine) {
              return (
                <View key={m.id} style={[styles.missing, { width: cardWidth, height: cardWidth * 1.4 }]}
                  accessibilityLabel={`Card ${i + 1}: ${m.name}, not collected yet`}>
                  <Text style={styles.slotNo}>#{i + 1}</Text>
                  <View style={styles.ghost}><CompetitorBadge id={m.id} size={cardWidth * 0.4} /></View>
                  <Text style={styles.missingName} numberOfLines={2}>{m.name}</Text>
                  <Text style={styles.slotNo}>Not collected</Text>
                </View>
              );
            }
            const best = bestForSlot(mine);
            const copies = groupCards(mine, showcase).find((g) => g.cards.some((x) => x.id === best.id))?.cards.length ?? 1;
            return (
              <Pressable key={m.id} onPress={() => router.push({ pathname: '/card/[id]', params: { id: best.id } })} accessibilityRole="button">
                <AnyCard card={best} width={cardWidth} count={copies} favorite={best.favorite} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: 60 },
  lead: { ...type.body, color: colors.textDim },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  missing: { borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, padding: space.sm,
    alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(19,26,39,0.5)' },
  ghost: { opacity: 0.18 },
  slotNo: { ...type.label, fontSize: 10, color: colors.loss },
  missingName: { fontSize: 12, fontWeight: '700', color: colors.loss, textAlign: 'center' },
});
