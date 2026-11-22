// One moment in the play-by-play feed. Fans rate each play from 1 to 10.
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Play } from '@/data/types';
import { formatNumber, timeAgo } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { createRng } from '@/lib/random';
import { colors, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';

/** What the rest of the crowd thinks of a play (simulated in the demo). */
export function crowdRating(play: Play, now: number): { average: number; count: number } {
  const rng = createRng(`rating:${play.id}`);
  const base = play.importance === 3 ? rng.float(7.6, 9.6) : play.importance === 2 ? rng.float(5.8, 8) : rng.float(3.5, 6.2);
  const ageMin = Math.max(0, (now - play.at) / 60_000);
  const reach = play.importance === 3 ? 900 : play.importance === 2 ? 260 : 60;
  const count = Math.round(reach * Math.min(1, 0.15 + ageMin / 8) * rng.float(0.7, 1.3));
  return { average: Math.round(base * 10) / 10, count };
}

const TAG_COLORS: Record<number, string> = { 3: colors.accent, 2: '#4DA3FF', 1: colors.loss };

interface PlayRowProps {
  play: Play;
  now: number;
  myRating: number | undefined;
  onRate: (rating: number) => void;
  canRate: boolean;
  onNeedAccount: () => void;
}

function PlayRowImpl({ play, now, myRating, onRate, canRate, onNeedAccount }: PlayRowProps) {
  const [open, setOpen] = useState(false);
  const crowd = crowdRating(play, now);
  const blended = myRating ? (crowd.average * crowd.count + myRating) / (crowd.count + 1) : crowd.average;
  const big = play.importance === 3;

  return (
    <View style={[styles.row, big && styles.rowBig]}>
      <View style={styles.left}>
        <Text style={styles.clock} numberOfLines={2}>{play.clock}</Text>
        {play.competitorId ? <CompetitorBadge id={play.competitorId} size={24} /> : <View style={styles.dot} />}
      </View>
      <View style={styles.body}>
        <View style={styles.tagRow}>
          {play.tag && !['OVER', 'HALF', 'PERIOD', 'ROUND', 'ROUND_END', 'GAP'].includes(play.tag) ? (
            <Text style={[styles.tag, { color: TAG_COLORS[play.importance] }]}>{play.tag.replace('_', ' ')}</Text>
          ) : null}
          {play.scoreAfter ? <Text style={styles.scoreAfter}>{play.scoreAfter}</Text> : null}
          <Text style={styles.ago}>{timeAgo(play.at, now)}</Text>
        </View>
        <Text style={[styles.desc, big && styles.descBig]}>{play.description}</Text>
        <Pressable
          onPress={() => (canRate ? setOpen(!open) : onNeedAccount())}
          accessibilityRole="button"
          accessibilityLabel={myRating ? `You rated this ${myRating}. Change rating` : 'Rate this play'}
          style={styles.rateBar}
        >
          <Text style={styles.avg}>★ {blended.toFixed(1)}</Text>
          <Text style={styles.count}>{formatNumber(crowd.count + (myRating ? 1 : 0), true)} ratings</Text>
          <Text style={[styles.rateCta, myRating ? styles.rated : null]}>{myRating ? `You: ${myRating}` : 'Rate'}</Text>
        </Pressable>
        {open && (
          <View style={styles.picker} accessibilityRole="radiogroup" accessibilityLabel="Rating from 1 to 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Pressable key={n} onPress={() => { tapLight(); onRate(n); setOpen(false); }}
                accessibilityRole="radio" accessibilityState={{ selected: myRating === n }} accessibilityLabel={`Rate ${n}`}
                style={[styles.pick, myRating === n && styles.pickOn, n >= 9 && styles.pickHot]}>
                <Text style={[styles.pickText, myRating === n && { color: colors.accentInk }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export const PlayRow = memo(PlayRowImpl);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.line },
  rowBig: { backgroundColor: 'rgba(255,182,39,0.06)' },
  left: { width: 60, alignItems: 'center', gap: 6 },
  clock: { ...type.label, color: colors.textDim, fontVariant: ['tabular-nums'], fontSize: 11, textAlign: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: 8 },
  body: { flex: 1, gap: 4 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { ...type.label, fontSize: 11 },
  scoreAfter: { ...type.label, fontSize: 11, color: colors.text, backgroundColor: colors.surfaceHigh, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden' },
  ago: { ...type.label, fontSize: 11, color: colors.loss, marginLeft: 'auto' },
  desc: { ...type.body, color: colors.text },
  descBig: { fontWeight: '700', fontSize: 16 },
  rateBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  avg: { ...type.label, color: colors.accent },
  count: { ...type.label, color: colors.textDim, flex: 1 },
  rateCta: { ...type.label, color: colors.text, backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden' },
  rated: { backgroundColor: 'rgba(255,182,39,0.2)', color: colors.accent },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pick: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  pickOn: { backgroundColor: colors.accent },
  pickHot: { borderWidth: 1, borderColor: 'rgba(255,182,39,0.5)' },
  pickText: { fontSize: 16, fontWeight: '800', color: colors.text },
});
