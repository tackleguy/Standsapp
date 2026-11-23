// The top three, on a podium: second, first (raised, crowned), third.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardEntry } from '@/data/demo/ranking';
import { withAlpha } from '@/lib/color';
import { formatNumber } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';

import { MovementTag } from './BoardRow';
import { FanAvatar } from './TierBadge';

const MEDAL = [colors.gold, colors.silver, colors.bronze];
const BASE_HEIGHT = [78, 56, 42];

function Step({ entry, place, onPress }: { entry: BoardEntry; place: 0 | 1 | 2; onPress: () => void }) {
  const medal = MEDAL[place];
  const first = place === 0;
  return (
    <Pressable onPress={onPress} style={styles.step} accessibilityRole="button"
      accessibilityLabel={`Number ${place + 1}, ${entry.isMe ? 'you' : entry.displayName}, ${entry.score} Clout`}>
      {first ? <MaterialCommunityIcons name="crown" size={26} color={colors.gold} style={styles.crown} /> : <View style={{ height: 26 }} />}
      <FanAvatar seed={entry.avatarSeed} name={entry.displayName} size={first ? 70 : 54} ring={medal} />
      <Text style={[styles.name, entry.isMe && { color: colors.accent }]} numberOfLines={1}>{entry.isMe ? 'You' : entry.displayName}</Text>
      <Text style={styles.handle} numberOfLines={1}>@{entry.username}</Text>
      <Text style={[styles.score, { color: medal }]} numberOfLines={1}>+{formatNumber(entry.score)}</Text>
      <View style={[styles.base, { height: BASE_HEIGHT[place], backgroundColor: withAlpha(medal, 0.14), borderTopColor: medal }]}>
        <Text style={[styles.place, { color: medal }]}>{place + 1}</Text>
        <MovementTag movement={entry.movement} size={10} />
      </View>
    </Pressable>
  );
}

export function Podium({ entries, onOpen }: { entries: BoardEntry[]; onOpen: (e: BoardEntry) => void }) {
  if (entries.length < 3) return null;
  const [one, two, three] = entries;
  return (
    <View style={styles.wrap}>
      <Step entry={two} place={1} onPress={() => onOpen(two)} />
      <Step entry={one} place={0} onPress={() => onOpen(one)} />
      <Step entry={three} place={2} onPress={() => onOpen(three)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  step: { flex: 1, alignItems: 'center' },
  crown: { marginBottom: -2 },
  name: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 6, maxWidth: '100%' },
  handle: { fontSize: 10, fontWeight: '600', color: colors.loss, maxWidth: '100%' },
  score: { fontFamily: fonts.heavy, fontSize: 19, marginTop: 2, fontVariant: ['tabular-nums'] },
  base: { alignSelf: 'stretch', marginTop: 6, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderTopWidth: 3,
    alignItems: 'center', justifyContent: 'center' },
  place: { fontFamily: fonts.black, fontSize: 30, lineHeight: 32 },
});
