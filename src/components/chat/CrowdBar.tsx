// The strip above a chat: how many people are in the stands right now.
import { StyleSheet, Text, View } from 'react-native';

import { crowdLabel } from '@/data/api';
import type { ChatState } from '@/hooks/useChat';
import { colors, space, type } from '@/theme/tokens';

import { LiveDot } from '../ui/LiveDot';

const TITLES: Record<ChatState['phase'], string> = {
  live: 'Live chat',
  pre: 'Pre-game chat',
  post: 'Post-game chat',
  section: 'Section chat',
};

export function CrowdBar({ phase, watchers, chatters, members }: Pick<ChatState, 'phase' | 'watchers' | 'chatters' | 'members'>) {
  const isSection = phase === 'section';
  const detail = isSection
    ? `${crowdLabel(chatters)} online · ${crowdLabel(members ?? 1)} member${members === 1 ? '' : 's'}`
    : watchers === null
      ? ''
      : phase === 'pre'
        ? `${crowdLabel(chatters)} chatting · ${crowdLabel(watchers)} waiting`
        : `${crowdLabel(chatters)} chatting · ${crowdLabel(watchers)} watching`;
  return (
    <View style={styles.bar} accessibilityRole="summary" accessibilityLabel={`${TITLES[phase]}. ${detail}`}>
      {phase === 'live' ? <LiveDot size={7} /> : <View style={[styles.dot, isSection && styles.dotOnline]} />}
      <Text style={[styles.title, phase === 'live' && styles.titleLive]}>{TITLES[phase]}</Text>
      <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 6,
    borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.loss },
  dotOnline: { backgroundColor: colors.win },
  title: { ...type.caps, fontSize: 13, color: colors.textDim },
  titleLive: { color: colors.text },
  detail: { ...type.caps, fontSize: 13, letterSpacing: 0.4, textTransform: 'none', color: colors.textDim, marginLeft: 'auto', flexShrink: 1 },
});
