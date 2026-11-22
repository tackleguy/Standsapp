// A live chat: newest at the bottom, composer within thumb reach, and moderation tools.
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChatMessage } from '@/data/types';
import { useChat } from '@/hooks/useChat';
import { useNow } from '@/hooks/useNow';
import { timeAgo } from '@/lib/format';
import { tapLight } from '@/lib/haptics';
import { COMMENT_MAX } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { Button, IconButton } from '../ui/Button';
import { Avatar } from '../ui/Misc';
import { Sheet } from '../ui/Sheet';
import { EmptyState, ErrorState, Skeleton } from '../ui/StateViews';

const EMOJI = ['🔥', '😂', '😮', '👏', '😤'];
const REASONS = ['Spam or scam', 'Harassment or bullying', 'Hate speech', 'Sexual content', 'Something else'];

export function ChatView({ threadId, onNeedAccount, placeholder = 'Say something to the stands…' }: {
  threadId: string; onNeedAccount: () => boolean; placeholder?: string;
}) {
  const { messages, isLoading, isError, refetch } = useChat(threadId);
  const now = useNow(15_000);
  const post = useUserStore((s) => s.postMessage);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const [text, setText] = useState('');
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);

  const send = () => {
    if (!onNeedAccount()) return;
    const err = post(threadId, text, Date.now());
    if (err) { toast(err, 'error'); return; }
    tapLight();
    setText('');
  };

  return (
    <View style={styles.wrap}>
      {isLoading ? <Skeleton rows={5} height={56} /> : isError ? <ErrorState onRetry={() => refetch()} /> : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MessageRow m={item} now={now} onMenu={() => setMenuFor(item)} />}
          ListEmptyComponent={<View style={styles.flip}><EmptyState icon="chatbubbles" title="Quiet in here" body="Be the first to say something." /></View>}
        />
      )}
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
      <MessageMenu message={menuFor} onClose={() => setMenuFor(null)} />
    </View>
  );
}

function MessageRow({ m, now, onMenu }: { m: ChatMessage; now: number; onMenu: () => void }) {
  const react = useUserStore((s) => s.react);
  const mineEmoji = useUserStore((s) => s.reactions[m.id]);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const entries = Object.entries(m.reactions).filter(([, n]) => n > 0);
  return (
    <Pressable onLongPress={onMenu} style={styles.msg} accessibilityLabel={`${m.displayName}: ${m.body}`}>
      <Avatar seed={m.avatarSeed} name={m.displayName} size={34} />
      <View style={styles.msgBody}>
        <View style={styles.msgHead}>
          <Text style={[styles.author, m.isMine && { color: colors.accent }]} numberOfLines={1}>{m.isMine ? 'You' : m.displayName}</Text>
          <Text style={styles.handle} numberOfLines={1}>@{m.username}</Text>
          {!m.isMine && m.userId.startsWith('fan_') ? <Text style={styles.demoFan}>demo fan</Text> : null}
          <Text style={styles.time}>{timeAgo(m.at, now)}</Text>
        </View>
        <Text style={styles.text}>{m.body}</Text>
        <View style={styles.reactRow}>
          {entries.map(([emoji, n]) => (
            <Pressable key={emoji} onPress={() => (isGuest ? toast('Create a free account to react.', 'info') : react(m.id, emoji))}
              accessibilityRole="button" accessibilityLabel={`${emoji} ${n}`}
              style={[styles.reaction, mineEmoji === emoji && styles.reactionMine]}>
              <Text style={styles.reactionText}>{emoji} {n}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="More actions" style={styles.more} hitSlop={8}>
            <Text style={styles.moreText}>•••</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function MessageMenu({ message, onClose }: { message: ChatMessage | null; onClose: () => void }) {
  const react = useUserStore((s) => s.react);
  const report = useUserStore((s) => s.report);
  const block = useUserStore((s) => s.block);
  const del = useUserStore((s) => s.deleteMessage);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const [reporting, setReporting] = useState(false);
  const close = () => { setReporting(false); onClose(); };
  if (!message) return null;
  return (
    <Sheet visible={!!message} onClose={close} title={reporting ? 'Report message' : message.isMine ? 'Your message' : `@${message.username}`}>
      {reporting ? (
        <>
          <Text style={styles.sheetText}>Why are you reporting this? We will hide it for you right away.</Text>
          {REASONS.map((r) => (
            <Button key={r} label={r} variant="secondary" onPress={() => {
              report(message.id, message.userId, r, Date.now());
              toast('Thanks. We hid that message and logged your report.', 'success');
              close();
            }} />
          ))}
        </>
      ) : (
        <>
          {!isGuest && (
            <View style={styles.emojiRow}>
              {EMOJI.map((e) => (
                <Pressable key={e} onPress={() => { react(message.id, e); close(); }} style={styles.emojiBtn} accessibilityRole="button" accessibilityLabel={`React ${e}`}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {message.isMine ? (
            <Button label="Delete my message" icon="trash" variant="danger" onPress={() => { del(message.id); toast('Message deleted.'); close(); }} />
          ) : (
            <>
              <Button label="Report message" icon="flag" variant="secondary" onPress={() => setReporting(true)} />
              <Button label={`Block @${message.username}`} icon="ban" variant="danger" onPress={() => {
                block(message.userId);
                toast(`Blocked @${message.username}. You will not see their messages.`, 'success');
                close();
              }} />
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { paddingVertical: space.md },
  flip: { transform: [{ scaleY: -1 }] },
  msg: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  msgBody: { flex: 1, gap: 2 },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  author: { ...type.label, fontSize: 13, color: colors.text, maxWidth: 130 },
  handle: { ...type.label, fontSize: 11, color: colors.loss, flexShrink: 1 },
  demoFan: { fontSize: 9, color: colors.textDim, borderWidth: 1, borderColor: colors.line, borderRadius: 4, paddingHorizontal: 3 },
  time: { ...type.label, fontSize: 11, color: colors.loss, marginLeft: 'auto' },
  text: { ...type.body, color: colors.text },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 2 },
  reaction: { backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.line },
  reactionMine: { borderColor: colors.accent },
  reactionText: { fontSize: 12, color: colors.text },
  more: { paddingHorizontal: 8, paddingVertical: 4 },
  moreText: { color: colors.loss, fontSize: 12, letterSpacing: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space.lg, color: colors.text, fontSize: 16 },
  sheetText: { ...type.body, color: colors.textDim },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  emojiBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
});
