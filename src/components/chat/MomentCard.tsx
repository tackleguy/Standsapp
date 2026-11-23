// A big moment dropped into the chat stream: "⚽ GOAL · 76' · BRA 2-1 RIV".
import { memo, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { competitorById, type ChatEntry } from '@/data/api';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { withAlpha } from '@/lib/color';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { teamTint } from './teamTint';

/** `pinned` is the compact version held under the crowd strip after a big moment. */
function MomentCardImpl({ m, animate, pinned = false }: { m: ChatEntry; animate: boolean; pinned?: boolean }) {
  const reduce = useReduceMotion();
  const [pop] = useState(() => new Animated.Value(animate && !reduce ? 0 : 1));
  useEffect(() => {
    if (!animate || reduce) return;
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [animate, reduce, pop]);
  const moment = m.moment;
  if (!moment) return null;
  const team = competitorById(moment.competitorId);
  const tint = team?.colors ? teamTint(team.colors) : moment.importance === 3 ? colors.accent : colors.textDim;
  const big = moment.importance === 3 && moment.tag !== 'PERIOD';
  return (
    <Animated.View
      style={[styles.card, pinned && styles.pinned, { borderColor: withAlpha(tint, 0.45), backgroundColor: withAlpha(tint, big ? 0.13 : 0.07) },
        { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}
      accessibilityLabel={`${moment.label}, ${moment.clock}. ${moment.description}`}
    >
      <View style={[styles.bar, { backgroundColor: tint }]} />
      <Text style={[styles.icon, pinned && { fontSize: 20 }]}>{moment.icon}</Text>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.label, { color: big ? colors.text : colors.textDim }]} numberOfLines={1}>{moment.label}</Text>
          <Text style={styles.clock} numberOfLines={1}>{moment.clock}</Text>
          {moment.line ? <Text style={[styles.line, { color: tint }]} numberOfLines={1}>{moment.line}</Text> : null}
        </View>
        <Text style={styles.desc} numberOfLines={pinned ? 1 : 2}>{moment.description}</Text>
      </View>
    </Animated.View>
  );
}

export const MomentCard = memo(MomentCardImpl);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.lg, marginVertical: space.sm,
    paddingVertical: space.sm, paddingRight: space.md, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  pinned: { marginTop: space.sm, marginBottom: 2, paddingVertical: 6 },
  bar: { width: 4, alignSelf: 'stretch' },
  icon: { fontSize: 24 },
  body: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  label: { fontFamily: fonts.black, fontSize: 18, letterSpacing: 0.6 },
  clock: { ...type.caps, fontSize: 13, color: colors.textDim },
  line: { fontFamily: fonts.heavy, fontSize: 17, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  desc: { ...type.body, fontSize: 13, lineHeight: 18, color: colors.textDim },
});
