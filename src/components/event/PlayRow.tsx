// One moment in the play-by-play feed: icon, team colour, score bug, and the
// crowd's 1-10 rating. Breaks in play (half-time, end of period) are dividers.
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Play } from '@/data/types';
import { withAlpha } from '@/lib/color';
import { formatNumber, timeAgo } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { createRng } from '@/lib/random';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { DIVIDER_TAGS, playIcon } from './playIcons';
import { bestInk, teamColor } from './teamColor';

/** What the rest of the crowd thinks of a play (simulated). */
export function crowdRating(play: Play, now: number): { average: number; count: number } {
  const rng = createRng(`rating:${play.id}`);
  const base = play.importance === 3 ? rng.float(7.6, 9.6) : play.importance === 2 ? rng.float(5.8, 8) : rng.float(3.5, 6.2);
  const ageMin = Math.max(0, (now - play.at) / 60_000);
  const reach = play.importance === 3 ? 900 : play.importance === 2 ? 260 : 60;
  const count = Math.round(reach * Math.min(1, 0.15 + ageMin / 8) * rng.float(0.7, 1.3));
  return { average: Math.round(base * 10) / 10, count };
}

interface PlayRowProps {
  play: Play;
  now: number;
  sportId: string;
  myRating: number | undefined;
  onRate: (rating: number) => void;
  canRate: boolean;
  onNeedAccount: () => void;
}

function tagLabel(tag: string): string {
  const map: Record<string, string> = { '2PT': '2 PTS', '3PT': '3 PTS', FT: 'FREE THROW', TO: 'TURNOVER', REB: 'REBOUND', '1ST': 'FIRST DOWN',
    TD: 'TOUCHDOWN', FG: 'FIELD GOAL', PAT: 'EXTRA POINT', SAF: 'SAFETY', INT: 'INTERCEPTION', HR: 'HOME RUN', K: 'STRIKEOUT',
    DP: 'DOUBLE PLAY', SC: 'SAFETY CAR', DNF: 'RETIRED', '4TH': '4TH DOWN', IN50: 'INSIDE 50', FREEKICK: 'FREE KICK',
    KNOCKON: 'KNOCK-ON', CONV: 'CONVERSION', PEN: 'PENALTY GOAL', SINBIN: 'SIN BIN', SETRESTART: 'SIX AGAIN', BIGPLAY: 'BIG PLAY' };
  return map[tag] ?? tag.replace(/_/g, ' ');
}

function PlayRowImpl({ play, now, sportId, myRating, onRate, canRate, onNeedAccount }: PlayRowProps) {
  const [open, setOpen] = useState(false);

  if (play.tag && DIVIDER_TAGS.has(play.tag)) {
    // "End of over 13: HOL 124/3 · need 42 from 42." -> title "End of over 13", text after the colon.
    const [head, ...rest] = play.description.split(': ');
    const split = play.tag === 'OVER' && rest.length > 0;
    const title = play.tag === 'START' ? 'Under way' : split ? head : play.clock;
    const text = split ? rest.join(': ') : play.description;
    return (
      <View style={styles.divider} accessibilityRole="header" accessibilityLabel={play.description}>
        <View style={styles.rule} />
        <View style={styles.dividerBody}>
          <Text style={styles.dividerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.dividerText} numberOfLines={2}>{text}</Text>
        </View>
        <View style={styles.rule} />
      </View>
    );
  }

  const crowd = crowdRating(play, now);
  const blended = myRating ? (crowd.average * crowd.count + myRating) / (crowd.count + 1) : crowd.average;
  const big = play.importance === 3;
  const key = play.importance >= 2;
  const color = play.competitorId ? teamColor(play.competitorId) : colors.textDim;
  const isScore = !!play.scoreAfter && play.tag !== 'FINAL';
  const toggle = () => (canRate ? setOpen(!open) : onNeedAccount());

  return (
    <View style={[styles.row, big && { backgroundColor: withAlpha(color, 0.1) }]}>
      {play.competitorId ? <View style={[styles.stripe, { backgroundColor: color, opacity: big ? 1 : key ? 0.7 : 0.35 }]} /> : null}
      <View style={styles.left}>
        <Text style={[styles.clock, big && { color: colors.text }]} numberOfLines={2}>{play.clock}</Text>
        <View style={[styles.iconBubble, big && styles.iconBig, { backgroundColor: withAlpha(color, big ? 0.28 : 0.14) }]}>
          <Text style={[styles.icon, big && { fontSize: 18 }]}>{playIcon(play.tag, sportId)}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.tagRow}>
          {play.tag ? <Text style={[styles.tag, { color: key ? color : colors.textDim }]}>{tagLabel(play.tag)}</Text> : null}
          {isScore ? (
            <View style={[styles.bug, { backgroundColor: color }]}>
              <Text style={[styles.bugText, { color: bestInk(color) }]}>{play.scoreAfter}</Text>
            </View>
          ) : null}
          {play.competitorId && key ? <CompetitorBadge id={play.competitorId} size={16} /> : null}
          <Text style={styles.ago}>{timeAgo(play.at, now)}</Text>
        </View>
        <Text style={[styles.desc, !key && styles.descMinor, big && styles.descBig]}>{play.description}</Text>
        {key ? (
          <Pressable onPress={toggle} accessibilityRole="button" style={styles.rateBar}
            accessibilityLabel={myRating ? `You rated this ${myRating}. Change rating` : 'Rate this play'}>
            <Text style={styles.avg}>★ {blended.toFixed(1)}</Text>
            <Text style={styles.count}>{formatNumber(crowd.count + (myRating ? 1 : 0), true)} ratings</Text>
            <Text style={[styles.rateCta, myRating ? styles.rated : null]}>{myRating ? `You: ${myRating}` : 'Rate'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={toggle} accessibilityRole="button" hitSlop={6} style={styles.rateMini}
            accessibilityLabel={myRating ? `You rated this ${myRating}. Change rating` : 'Rate this play'}>
            <Text style={styles.rateMiniText}>★ {blended.toFixed(1)}{myRating ? ` · You: ${myRating}` : ' · Rate'}</Text>
          </Pressable>
        )}
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
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  left: { width: 52, alignItems: 'center', gap: 6 },
  clock: { fontFamily: fonts.bold, fontSize: 14, color: colors.textDim, fontVariant: ['tabular-nums'], textAlign: 'center' },
  iconBubble: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconBig: { width: 36, height: 36, borderRadius: 18 },
  icon: { fontSize: 15 },
  body: { flex: 1, gap: 4 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { fontFamily: fonts.heavy, fontSize: 13, letterSpacing: 0.8 },
  bug: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  bugText: { fontFamily: fonts.heavy, fontSize: 13, color: '#0A0E17', fontVariant: ['tabular-nums'] },
  ago: { ...type.label, fontSize: 11, color: colors.loss, marginLeft: 'auto' },
  desc: { ...type.body, color: colors.text },
  descMinor: { fontSize: 14, color: '#C9D1E0', lineHeight: 19 },
  descBig: { fontWeight: '700', fontSize: 17, lineHeight: 23 },
  rateBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  avg: { ...type.label, color: colors.accent },
  count: { ...type.label, color: colors.textDim, flex: 1 },
  rateCta: { ...type.label, color: colors.text, backgroundColor: colors.surfaceHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden' },
  rated: { backgroundColor: 'rgba(255,182,39,0.2)', color: colors.accent },
  rateMini: { alignSelf: 'flex-start', paddingVertical: 2 },
  rateMiniText: { ...type.label, fontSize: 11, color: colors.loss },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pick: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  pickOn: { backgroundColor: colors.accent },
  pickHot: { borderWidth: 1, borderColor: 'rgba(255,182,39,0.5)' },
  pickText: { fontSize: 16, fontWeight: '800', color: colors.text },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg,
    borderBottomWidth: 1, borderColor: colors.line, backgroundColor: 'rgba(255,255,255,0.02)' },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerBody: { alignItems: 'center', maxWidth: '70%', gap: 2 },
  dividerTitle: { ...type.caps, fontSize: 14, color: colors.accent },
  dividerText: { fontSize: 12, color: colors.textDim, textAlign: 'center' },
});
