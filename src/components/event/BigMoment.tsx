// A full-width banner in the scoring team's colours when something big happens
// while you are watching: GOAL!, TRY!, TOUCHDOWN!, WICKET!... Never on first load.
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { competitorById } from '@/data/api';
import type { EventState, Play } from '@/data/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { luminance, mix, withAlpha } from '@/lib/color';
import { tapSuccess } from '@/lib/haptics';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { headlineFor, playIcon } from './playIcons';
import { bestInk, teamColor } from './teamColor';

interface Moment {
  play: Play;
  headline: string;
}

const SHOW_MS = 3600;

export function BigMoment({ state }: { state: EventState }) {
  const reduce = useReduceMotion();
  const seen = useRef<number | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const anim = useState(() => new Animated.Value(0))[0];

  const lastSeq = state.plays.length ? state.plays[state.plays.length - 1].seq : 0;
  useEffect(() => {
    // First time we see this event: remember where we are, celebrate nothing.
    if (seen.current === null) { seen.current = lastSeq; return; }
    if (lastSeq <= seen.current) return;
    const fresh = state.plays.filter((p) => p.seq > (seen.current as number));
    seen.current = lastSeq;
    const big = [...fresh].reverse().find((p) => p.importance === 3 && headlineFor(p.tag, state.meta.sportId));
    if (!big) return;
    setMoment({ play: big, headline: headlineFor(big.tag, state.meta.sportId) as string });
  }, [lastSeq, state.plays, state.meta.sportId]);

  useEffect(() => {
    if (!moment) return;
    tapSuccess();
    anim.setValue(0);
    const seq = reduce
      ? Animated.sequence([Animated.timing(anim, { toValue: 1, duration: 1, useNativeDriver: true }), Animated.delay(SHOW_MS),
        Animated.timing(anim, { toValue: 2, duration: 1, useNativeDriver: true })])
      : Animated.sequence([
        Animated.spring(anim, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
        Animated.delay(SHOW_MS),
        Animated.timing(anim, { toValue: 2, duration: 320, useNativeDriver: true }),
      ]);
    seq.start(({ finished }) => { if (finished) setMoment(null); });
    return () => seq.stop();
  }, [moment, anim, reduce]);

  if (!moment) return null;
  const { play, headline } = moment;
  const team = competitorById(play.competitorId);
  // The real kit colour (very dark kits lifted a touch so the banner still pops).
  const kit = team?.colors?.[0] ?? competitorById(team?.parentId)?.colors?.[0] ?? colors.accent;
  const bg = luminance(kit) < 0.03 ? mix(kit, '#FFFFFF', 0.14) : kit;
  const base = play.competitorId ? teamColor(play.competitorId) : colors.accent;
  const ink = bestInk(bg);
  const scale = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [0.6, 1, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.4, 1, 1.6, 2], outputRange: [0, 1, 1, 0.6, 0] });
  const translateY = anim.interpolate({ inputRange: [0, 1, 2], outputRange: [-30, 0, -20] });

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { opacity, transform: [{ translateY }] }]}>
      <Pressable onPress={() => setMoment(null)} accessibilityRole="alert" accessibilityLabel={`${headline} ${play.description}`}
        style={[styles.banner, { backgroundColor: bg, shadowColor: base }]}>
        <View style={[styles.flare, { backgroundColor: withAlpha('#FFFFFF', 0.08) }]} />
        <View style={styles.row}>
          {team ? <CompetitorBadge id={team.id} size={40} /> : <Text style={styles.emoji}>{playIcon(play.tag, state.meta.sportId)}</Text>}
          <View style={{ flex: 1 }}>
            <Animated.Text style={[styles.headline, { color: ink, transform: [{ scale }] }]} numberOfLines={1}>{headline}</Animated.Text>
            <Text style={[styles.desc, { color: ink }]} numberOfLines={2}>{play.description}</Text>
          </View>
          {play.scoreAfter ? (
            <View style={[styles.score, { backgroundColor: withAlpha(ink === '#FFFFFF' ? '#000000' : '#FFFFFF', 0.22) }]}>
              <Text style={[styles.scoreText, { color: ink }]}>{play.scoreAfter}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, top: space.sm, zIndex: 50 },
  banner: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, overflow: 'hidden',
    shadowOpacity: 0.7, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  flare: { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emoji: { fontSize: 34 },
  headline: { fontFamily: fonts.black, fontSize: 38, lineHeight: 40, letterSpacing: 0.5, fontStyle: 'italic' },
  desc: { fontSize: 13, fontWeight: '600', opacity: 0.92 },
  score: { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { fontFamily: fonts.heavy, fontSize: 24, fontVariant: ['tabular-nums'] },
});
