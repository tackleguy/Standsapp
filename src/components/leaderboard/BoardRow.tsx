// One row of a leaderboard: rank and movement, fan, form, and Clout won.
// When a rank changes between refreshes the row flashes green or red.
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardEntry, Movement } from '@/data/demo/ranking';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatNumber } from '@/lib/format';
import { colors, fonts, space, type } from '@/theme/tokens';

import { Icon, sportIcon } from '../ui/Icon';
import { FanAvatar } from './TierBadge';

export function MovementTag({ movement, size = 11 }: { movement: Movement; size?: number }) {
  if (movement === null) return null;
  if (movement === 'new') return <Text style={[styles.move, { color: colors.accent, fontSize: size }]}>NEW</Text>;
  if (movement === 0) return <Text style={[styles.move, { color: colors.loss, fontSize: size }]}>–</Text>;
  const up = movement > 0;
  return (
    <View style={styles.moveRow} accessibilityLabel={`${up ? 'Up' : 'Down'} ${Math.abs(movement)}`}>
      <Icon name={up ? 'caret-up' : 'caret-down'} size={size} color={up ? colors.up : colors.down} />
      <Text style={[styles.move, { color: up ? colors.up : colors.down, fontSize: size }]}>{formatNumber(Math.abs(movement))}</Text>
    </View>
  );
}

function RankNumber({ rank }: { rank: number | null }) {
  const text = rank === null ? '–' : formatNumber(rank);
  const size = text.length <= 3 ? 21 : text.length <= 5 ? 17 : 14;
  return <Text style={[styles.rank, { fontSize: size }, (rank ?? 99) <= 3 && { color: colors.accent }]} numberOfLines={1}>{text}</Text>;
}

interface Props {
  entry: BoardEntry;
  onPress: () => void;
}

function BoardRowImpl({ entry, onPress }: Props) {
  const reduce = useReduceMotion();
  const prev = useRef(entry.rank);
  const flash = useState(() => new Animated.Value(0))[0];
  const [dir, setDir] = useState<'up' | 'down'>('up');
  useEffect(() => {
    const before = prev.current;
    prev.current = entry.rank;
    if (reduce || before === null || entry.rank === null || before === entry.rank) return;
    setDir(entry.rank < before ? 'up' : 'down');
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 1400, useNativeDriver: false }).start();
  }, [entry.rank, flash, reduce]);
  const tint = flash.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', dir === 'up' ? 'rgba(61,220,151,0.22)' : 'rgba(255,107,120,0.22)'] });

  const tix = entry.cards !== null;
  const sub = tix ? `🃏 ${formatNumber(entry.cards ?? 0)}` : entry.streak >= 3 ? `🔥${entry.streak}` : entry.winRate > 0 ? `${entry.winRate}%` : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`Rank ${entry.rank ?? 'unranked'}, ${entry.isMe ? 'you' : entry.displayName}, ${entry.score} ${tix ? 'Tix' : 'Clout'}`}>
      {({ pressed }) => (
        <Animated.View style={[styles.row, entry.isMe && styles.rowMe, { backgroundColor: entry.isMe ? 'rgba(255,182,39,0.09)' : tint },
          pressed && styles.pressed]}>
          <View style={styles.rankCol}>
            <RankNumber rank={entry.rank} />
            <MovementTag movement={entry.movement} />
          </View>
          <FanAvatar seed={entry.avatarSeed} name={entry.displayName} size={38} tier={entry.tier} />
          <View style={styles.who}>
            <Text style={[styles.name, entry.isMe && { color: colors.accent }]} numberOfLines={1}>{entry.isMe ? 'You' : entry.displayName}</Text>
            <View style={styles.subRow}>
              {entry.favoriteSportId ? <Icon name={sportIcon(entry.favoriteSportId)} size={11} color={colors.textDim} /> : null}
              <Text style={styles.handle} numberOfLines={1}>@{entry.username}</Text>
              {sub ? <Text style={styles.form} numberOfLines={1}>{sub}</Text> : null}
            </View>
          </View>
          <View style={styles.scoreCol}>
            <Text style={styles.score} numberOfLines={1}>{entry.score > 0 ? `+${formatNumber(entry.score)}` : '0'}</Text>
            <Text style={styles.unit}>{tix ? 'TIX' : 'CLOUT'}</Text>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

export const BoardRow = memo(BoardRowImpl);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 8, minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  rowMe: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: space.lg - 3 },
  pressed: { opacity: 0.75 },
  rankCol: { width: 48, alignItems: 'center' },
  rank: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  moveRow: { flexDirection: 'row', alignItems: 'center' },
  move: { fontFamily: fonts.bold, letterSpacing: 0.4 },
  who: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  handle: { ...type.label, fontSize: 11, color: colors.textDim, flexShrink: 1, letterSpacing: 0.2 },
  form: { fontFamily: fonts.bold, fontSize: 12, color: colors.textDim, letterSpacing: 0.4 },
  scoreCol: { alignItems: 'flex-end' },
  score: { fontFamily: fonts.heavy, fontSize: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.semibold, fontSize: 10, color: colors.loss, letterSpacing: 1 },
});
