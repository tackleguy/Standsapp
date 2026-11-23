// One chat message: avatar, name, the side they back, a quoted reply, reactions.
import { memo, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { competitorById, type ChatEntry } from '@/data/api';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { withAlpha } from '@/lib/color';
import { timeAgo } from '@/lib/format';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Avatar } from '../ui/Misc';
import { teamTint } from './teamTint';

/** "● BRA" in the colours of the side this fan is backing. */
export function SupporterChip({ competitorId }: { competitorId: string }) {
  const c = competitorById(competitorId);
  if (!c) return null;
  const tint = teamTint(c.colors);
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(tint, 0.14), borderColor: withAlpha(tint, 0.45) }]}
      accessibilityLabel={`Backing ${c.name}`}>
      <View style={[styles.chipDot, { backgroundColor: tint }]} />
      <Text style={[styles.chipText, { color: tint }]}>{c.shortName}</Text>
    </View>
  );
}

interface Props {
  m: ChatEntry;
  /** 0 hides the time (busy live chats); otherwise "now" for "5m ago". */
  now: number;
  animate: boolean;
  myEmoji: string | undefined;
  onMenu: (m: ChatEntry) => void;
  onReact: (m: ChatEntry, emoji: string) => void;
  onOpenFan: (userId: string) => void;
}

function MessageRowImpl({ m, now, animate, myEmoji, onMenu, onReact, onOpenFan }: Props) {
  const reduce = useReduceMotion();
  const [enter] = useState(() => new Animated.Value(animate && !reduce ? 0 : 1));
  useEffect(() => {
    if (!animate || reduce) return;
    Animated.timing(enter, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [animate, reduce, enter]);
  const entries = Object.entries(m.reactions).filter(([, n]) => n > 0);
  const canOpen = !m.isMine && m.userId.startsWith('fan_');
  // The quote already shows who is being answered, so drop the leading @name.
  const body = m.replyTo && m.body.startsWith(`@${m.replyTo.username} `) ? m.body.slice(m.replyTo.username.length + 2) : m.body;
  const open = () => { if (canOpen) onOpenFan(m.userId); };

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      <Pressable onLongPress={() => onMenu(m)} style={[styles.msg, m.isMine && styles.msgMine]} accessibilityLabel={`${m.isMine ? 'You' : m.displayName}: ${m.body}`}>
        <Pressable onPress={open} disabled={!canOpen} accessibilityRole={canOpen ? 'button' : undefined}
          accessibilityLabel={canOpen ? `Open ${m.displayName}'s profile` : undefined} hitSlop={4}>
          <Avatar seed={m.avatarSeed} name={m.displayName} size={32} />
        </Pressable>
        <View style={styles.body}>
          <View style={styles.head}>
            <Pressable onPress={open} disabled={!canOpen} style={styles.nameWrap} hitSlop={4}>
              <Text style={[styles.author, m.isMine && { color: colors.accent }]} numberOfLines={1}>{m.isMine ? 'You' : m.displayName}</Text>
              <Text style={styles.handle} numberOfLines={1}>@{m.username}</Text>
            </Pressable>
            {m.supports ? <SupporterChip competitorId={m.supports} /> : null}
            {now ? <Text style={styles.time}>{timeAgo(m.at, now)}</Text> : null}
            <Pressable onPress={() => onMenu(m)} accessibilityRole="button" accessibilityLabel="More actions" style={styles.more} hitSlop={10}>
              <Text style={styles.moreText}>•••</Text>
            </Pressable>
          </View>
          {m.replyTo ? (
            <View style={styles.quote}>
              <Text style={styles.quoteText} numberOfLines={1}>
                <Text style={styles.quoteName}>@{m.replyTo.username} </Text>{m.replyTo.body}
              </Text>
            </View>
          ) : null}
          <Text style={styles.text}>{body}</Text>
          {entries.length > 0 ? (
            <View style={styles.reactRow}>
              {entries.map(([emoji, n]) => (
                <Pressable key={emoji} onPress={() => onReact(m, emoji)} accessibilityRole="button" accessibilityLabel={`${emoji} ${n}`}
                  style={[styles.reaction, myEmoji === emoji && styles.reactionMine]}>
                  <Text style={styles.reactionText}>{emoji} {n}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const MessageRow = memo(MessageRowImpl);

const styles = StyleSheet.create({
  msg: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 7 },
  msgMine: { backgroundColor: 'rgba(255,182,39,0.06)' },
  body: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  nameWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 },
  author: { ...type.label, fontSize: 13, color: colors.text, maxWidth: 140 },
  handle: { ...type.label, fontSize: 11, color: colors.loss, flexShrink: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 },
  time: { ...type.label, fontSize: 11, color: colors.loss },
  more: { marginLeft: 'auto', paddingHorizontal: 4 },
  moreText: { color: colors.loss, fontSize: 11, letterSpacing: 1 },
  quote: { borderLeftWidth: 2, borderColor: colors.line, paddingLeft: space.sm, marginTop: 1 },
  quoteText: { ...type.label, fontSize: 12, fontWeight: '400', color: colors.textDim },
  quoteName: { fontWeight: '700', color: colors.textDim },
  text: { ...type.body, color: colors.text },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 3 },
  reaction: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.line },
  reactionMine: { borderColor: colors.accent, backgroundColor: 'rgba(255,182,39,0.14)' },
  reactionText: { fontSize: 12, color: colors.text },
});
