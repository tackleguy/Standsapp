// A play in the feed, as a card: the score and situation, the main player's
// picture, a headline ("13-yd catch"), every player's running stat line (tap to
// open their Performance page), football notes (first down, yards after the
// catch), the play's rating, crowd reactions, comments and share.
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlayLine } from '@/data/playerApi';
import type { EventState, Play } from '@/data/types';
import { withAlpha } from '@/lib/color';
import { formatNumber, timeAgo } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { createRng } from '@/lib/random';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Impact } from '../players/PerformanceParts';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { clockAndDown, scoreWithTeams } from '../players/playText';
import { Icon } from '../ui/Icon';
import { crowdRating } from './PlayRow';
import { teamColor } from './teamColor';

interface Props {
  play: Play;
  state: EventState;
  lines: PlayLine[];
  scoreBefore: string | undefined;
  now: number;
  myRating: number | undefined;
  canRate: boolean;
  onRate: (n: number) => void;
  onNeedAccount: () => void;
  onComments: () => void;
}

/** Short notes under the players: first down, yards after the catch, touchdown... */
function notes(play: Play): { icon: string; text: string }[] {
  const f = play.football;
  const out: { icon: string; text: string }[] = [];
  if (f) {
    if (f.touchdown) out.push({ icon: '🏈', text: 'Touchdown' });
    else if (f.firstDown && f.kind !== 'penalty') out.push({ icon: '✅', text: f.down === 4 ? 'Converts on 4th down' : f.down === 3 ? '3rd-down conversion' : '1st down' });
    if (f.yac !== null && f.yac > 0) out.push({ icon: '🏃', text: `${f.yac} yard${f.yac === 1 ? '' : 's'} after catch` });
    if (play.tag === 'INT' || play.tag === 'FUMBLE') out.push({ icon: '🔁', text: 'Turnover' });
  } else if (play.scoreAfter && play.tag !== 'FINAL') {
    out.push({ icon: '🔥', text: `Score: ${play.scoreAfter}` });
  }
  return out;
}

function PlayCardImpl({ play, state, lines, scoreBefore, now, myRating, canRate, onRate, onNeedAccount, onComments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const main = lines[0];
  const color = play.competitorId ? teamColor(play.competitorId) : colors.textDim;
  const big = play.importance === 3;
  const crowd = crowdRating(play, now);
  const comments = Math.round(crowd.count * createRng(`c:${play.id}`).float(0.6, 1.8));
  const score = scoreWithTeams(state, scoreBefore);
  const openPlayer = (playerId: string) => router.push({ pathname: '/player/[id]', params: { id: playerId, event: state.meta.id } });
  const toggle = () => (canRate ? setOpen(!open) : onNeedAccount());

  return (
    <View style={[styles.card, big && { backgroundColor: withAlpha(color, 0.08) }]}>
      <View style={styles.meta}>
        {play.competitorId ? <CompetitorBadge id={play.competitorId} size={14} /> : null}
        <Text style={styles.metaText} numberOfLines={1}>{[score, clockAndDown(play)].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.ago}>{timeAgo(play.at, now)}</Text>
        {play.impact !== undefined ? <Impact value={play.impact} /> : null}
      </View>

      <View style={styles.main}>
        {main ? (
          <Pressable onPress={() => openPlayer(main.playerId)} accessibilityRole="button" accessibilityLabel={`Open ${main.short}'s performance`}>
            <PlayerAvatar playerId={main.playerId} size={52} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.headline, big && { color }]} numberOfLines={2}>{play.headline ?? play.description}</Text>
          {lines.map((l, i) => (
            <Pressable key={`${l.playerId}-${i}`} onPress={() => openPlayer(l.playerId)} accessibilityRole="link" hitSlop={4}
              accessibilityLabel={`${l.short}, ${l.text}. Open performance`}>
              <Text style={[styles.line, i > 0 && styles.lineDim]} numberOfLines={1}>
                <Text style={i === 0 ? styles.lineName : styles.lineNameDim}>{l.short}</Text>{l.text ? ` · ${l.text}` : ''}
              </Text>
            </Pressable>
          ))}
          {notes(play).map((n) => (
            <Text key={n.text} style={styles.note}>{n.icon}  {n.text}</Text>
          ))}
          {!play.football && play.headline ? <Text style={styles.desc} numberOfLines={3}>{play.description}</Text> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={toggle} accessibilityRole="button" hitSlop={6} style={styles.action}
          accessibilityLabel={myRating ? `You rated this ${myRating}. Change rating` : 'Rate this play'}>
          <Text style={styles.actionText}>😀 {formatNumber(crowd.count + (myRating ? 1 : 0), true)}</Text>
          <Text style={[styles.rate, myRating ? styles.rated : null]}>{myRating ? `You: ${myRating}` : 'Rate'}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onComments} accessibilityRole="button" hitSlop={6} style={styles.action} accessibilityLabel="Open the chat">
          <Icon name="chatbubble" size={15} color={colors.textDim} />
          <Text style={styles.actionText}>{formatNumber(comments, true)}</Text>
        </Pressable>
        <Pressable onPress={() => sharePlay(play, state)} accessibilityRole="button" hitSlop={6} style={styles.action} accessibilityLabel="Share this play">
          <Icon name="paper-plane" size={16} color={colors.textDim} />
        </Pressable>
      </View>
      {open ? (
        <View style={styles.picker} accessibilityRole="radiogroup" accessibilityLabel="Rating from 1 to 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pressable key={n} onPress={() => { tapLight(); onRate(n); setOpen(false); }} accessibilityRole="radio"
              accessibilityState={{ selected: myRating === n }} accessibilityLabel={`Rate ${n}`}
              style={[styles.pick, myRating === n && styles.pickOn]}>
              <Text style={[styles.pickText, myRating === n && { color: colors.accentInk }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const PlayCard = memo(PlayCardImpl);

async function sharePlay(play: Play, state: EventState) {
  const { Share } = await import('react-native');
  try {
    await Share.share({ message: `${play.headline ?? play.description} — ${state.meta.title} on Stands` });
  } catch {
    // Sharing is optional.
  }
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderColor: colors.line },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...type.label, color: colors.textDim, flex: 1 },
  ago: { ...type.label, fontSize: 11, color: colors.loss },
  main: { flexDirection: 'row', gap: space.md },
  headline: { fontFamily: fonts.heavy, fontSize: 22, color: colors.text, lineHeight: 26 },
  line: { fontSize: 15, color: colors.text },
  lineDim: { fontSize: 14, color: colors.textDim },
  lineName: { fontWeight: '700', color: colors.text },
  lineNameDim: { fontWeight: '600', color: colors.textDim },
  note: { fontSize: 14, color: colors.text },
  desc: { fontSize: 13, color: colors.textDim, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingLeft: 64, minHeight: 32 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  actionText: { ...type.label, color: colors.textDim, fontSize: 13 },
  rate: { ...type.label, fontSize: 12, color: colors.text, backgroundColor: colors.surfaceHigh, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, overflow: 'hidden' },
  rated: { backgroundColor: 'rgba(255,182,39,0.2)', color: colors.accent },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 64 },
  pick: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  pickOn: { backgroundColor: colors.accent },
  pickText: { fontSize: 15, fontWeight: '800', color: colors.text },
});
