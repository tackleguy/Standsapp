// Shown on a game's screen while its Game Pack is on sale.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EventState } from '@/data/types';
import { gamePackOpen } from '@/logic/packs';
import { GAME_DAY_WIN_MULTIPLIER, PACK_TYPES } from '@/logic/rules';
import { colors, radius, space, type } from '@/theme/tokens';

import { Icon } from '../ui/Icon';
import { PackArt } from './PackArt';

export function GamePackBanner({ state, now }: { state: EventState; now: number }) {
  const router = useRouter();
  if (!gamePackOpen(state, now)) return null;
  const pack = PACK_TYPES.game;
  return (
    <Pressable onPress={() => router.push({ pathname: '/pack', params: { event: state.meta.id } })}
      accessibilityRole="button" accessibilityLabel={`Game Pack for this game, ${pack.cost} Tix`}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}>
      <PackArt packId="game" width={34} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Game Pack · {pack.size} cards from this game</Text>
        <Text style={styles.body}>Game Day cards pay {GAME_DAY_WIN_MULTIPLIER}× Tix if their side wins this game.</Text>
      </View>
      <Text style={styles.price}>{pack.cost} Tix</Text>
      <Icon name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,94,0.08)', borderWidth: 1, borderColor: 'rgba(255,77,94,0.4)' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  body: { ...type.label, color: colors.textDim, marginTop: 2, lineHeight: 16 },
  price: { ...type.label, color: colors.text, fontSize: 13 },
});
