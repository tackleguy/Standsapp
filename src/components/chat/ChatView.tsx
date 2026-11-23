// A live chat: crowd strip on top, newest message at the bottom, big moments
// dropped in as cards, people typing, quick reactions that float up the screen,
// and the composer within thumb reach. Moderation tools stay one press away.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { ChatEntry } from '@/data/api';
import { useChat } from '@/hooks/useChat';
import { useNow } from '@/hooks/useNow';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { tapLight } from '@/lib/haptics';
import { COMMENT_MAX } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { Button, IconButton } from '../ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../ui/StateViews';
import { CrowdBar } from './CrowdBar';
import { FloatingLayer, useFloaters } from './Floaters';
import { MessageMenu, QUICK_EMOJI } from './MessageMenu';
import { MessageRow } from './MessageRow';
import { MomentCard } from './MomentCard';
import { TypingDots } from './TypingDots';

const CROWD_EMOJI = ['🔥', '🎉', '👏', '😱', '🙌', '🔥', '😤'];

export function ChatView({ threadId, onNeedAccount, placeholder = 'Say something to the stands…' }: {
  threadId: string; onNeedAccount: () => boolean; placeholder?: string;
}) {
  const chat = useChat(threadId);
  const isSection = threadId.startsWith('section:');
  const router = useRouter();
  const reduce = useReduceMotion();
  const clock = useNow(30_000);
  const post = useUserStore((s) => s.postMessage);
  const react = useUserStore((s) => s.react);
  const myReactions = useUserStore((s) => s.reactions);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const [text, setText] = useState('');
  const [menuFor, setMenuFor] = useState<ChatEntry | null>(null);
  const [openedAt] = useState(() => Date.now());
  const [scrolledUpAt, setScrolledUpAt] = useState<number | null>(null);
  const listRef = useRef<FlatList<ChatEntry>>(null);
  const { items: floaters, spawn, remove } = useFloaters(!reduce);

  // When something big happens, the whole crowd sends emoji up the screen.
  const hypeAt = chat.hype?.at ?? 0;
  const hypeIcon = chat.hype?.icon ?? '🔥';
  useEffect(() => {
    if (!hypeAt || reduce || Date.now() - hypeAt > 20_000) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      const pool = [hypeIcon, hypeIcon, ...CROWD_EMOJI];
      spawn(pool[Math.floor(Math.random() * pool.length)], n % 6 === 0);
      if (n >= 28) clearInterval(id);
    }, 240);
    return () => clearInterval(id);
  }, [hypeAt, hypeIcon, reduce, spawn]);

  const openFan = useCallback((id: string) => router.push({ pathname: '/fan/[id]', params: { id } }), [router]);
  const onReact = useCallback((m: ChatEntry, emoji: string) => {
    if (isGuest) { toast('Create a free account to react.', 'info'); return; }
    react(m.id, emoji);
  }, [isGuest, react]);
  const onMenu = useCallback((m: ChatEntry) => { if (m.kind === 'fan') setMenuFor(m); }, []);

  const toBottom = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setScrolledUpAt(null);
  };

  const send = () => {
    if (!onNeedAccount()) return;
    const err = post(threadId, text, Date.now());
    if (err) { toast(err, 'error'); return; }
    tapLight();
    setText('');
    toBottom();
  };

  const quickReact = (emoji: string) => {
    if (isGuest) { toast('Create a free account to react.', 'info'); return; }
    tapLight();
    spawn(emoji, true);
    setTimeout(() => spawn(emoji), 140);
    setTimeout(() => spawn(emoji), 300);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The list is upside down: offset 0 is the newest message.
    const y = e.nativeEvent.contentOffset.y;
    if (y > 160 && scrolledUpAt === null) setScrolledUpAt(chat.updatedAt || Date.now());
    else if (y <= 40 && scrolledUpAt !== null) setScrolledUpAt(null);
  };

  // Hold the latest big moment under the crowd strip for a minute and a half,
  // so it is still on screen while the chat goes wild below it.
  let pinned: ChatEntry | null = null;
  for (const m of chat.messages) {
    if (chat.updatedAt - m.at > 90_000) break;
    if (m.kind === 'moment' && m.moment && m.moment.importance === 3 && m.moment.tag !== 'PERIOD' && m.moment.tag !== 'START') { pinned = m; break; }
  }

  let unread = 0;
  if (scrolledUpAt !== null) {
    for (const m of chat.messages) {
      if (m.at <= scrolledUpAt) break;
      unread++;
    }
  }

  const renderItem = ({ item }: { item: ChatEntry }) => {
    const animate = item.at >= openedAt && chat.updatedAt - item.at < 6000;
    if (item.kind === 'moment') return <MomentCard m={item} animate={animate} />;
    return (
      <MessageRow m={item} now={isSection ? clock : 0} animate={animate} myEmoji={myReactions[item.id]}
        onMenu={onMenu} onReact={onReact} onOpenFan={openFan} />
    );
  };

  return (
    <View style={styles.wrap}>
      <CrowdBar phase={chat.phase} watchers={chat.watchers} chatters={chat.chatters} members={chat.members} />
      {pinned ? <MomentCard key={pinned.id} m={pinned} animate={!reduce} pinned /> : null}
      <View style={styles.listArea}>
        {chat.isLoading ? <Skeleton rows={6} height={52} /> : chat.isError ? <ErrorState onRetry={chat.refetch} /> : (
          <FlatList
            ref={listRef}
            inverted
            data={chat.messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            onScroll={onScroll}
            scrollEventThrottle={64}
            initialNumToRender={18}
            maxToRenderPerBatch={12}
            windowSize={11}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<View style={styles.flip}><EmptyState icon="chatbubbles" title="Quiet in here" body="Be the first to say something." /></View>}
          />
        )}
        {unread > 0 ? (
          <Pressable onPress={toBottom} style={styles.pill} accessibilityRole="button" accessibilityLabel={`${unread} new messages. Jump to latest`}>
            <Text style={styles.pillText}>{unread > 99 ? '99+' : unread} new message{unread === 1 ? '' : 's'} ↓</Text>
          </Pressable>
        ) : null}
        <FloatingLayer items={floaters} onDone={remove} />
      </View>
      <View style={styles.tray}>
        <TypingDots names={chat.typing} />
        <View style={styles.quick} accessibilityRole="toolbar" accessibilityLabel="Quick reactions">
          {QUICK_EMOJI.map((e) => (
            <Pressable key={e} onPress={() => quickReact(e)} accessibilityRole="button" accessibilityLabel={`Send ${e}`} hitSlop={6}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.quickPressed]}>
              <Text style={styles.quickEmoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.composer}>
        {isGuest ? (
          <Button label="Create a free account to chat" icon="chatbubble-ellipses" onPress={() => onNeedAccount()} style={{ flex: 1 }} />
        ) : (
          <>
            <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.loss}
              style={styles.input} maxLength={COMMENT_MAX} onSubmitEditing={send} returnKeyType="send" accessibilityLabel="Message" />
            <IconButton icon="send" label="Send message" onPress={send} color={text.trim() ? colors.accent : colors.loss} />
          </>
        )}
      </View>
      <MessageMenu message={menuFor} onClose={() => setMenuFor(null)} onOpenFan={openFan} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  listArea: { flex: 1 },
  list: { paddingVertical: space.sm },
  flip: { transform: [{ scaleY: -1 }] },
  pill: { position: 'absolute', bottom: space.md, alignSelf: 'center', backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: space.lg, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pillText: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 0.4, color: colors.accentInk },
  tray: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: space.sm, minHeight: 40,
    borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  quick: { flexDirection: 'row', gap: 2 },
  quickBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  quickPressed: { backgroundColor: colors.surfaceHigh, transform: [{ scale: 0.9 }] },
  quickEmoji: { fontSize: 20 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm, paddingTop: 2,
    backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space.lg, color: colors.text, fontSize: 16 },
});
