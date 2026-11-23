// Long-press menu on a message: react, view profile, report, block, or delete your own.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatEntry } from '@/data/api';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

export const QUICK_EMOJI = ['🔥', '😂', '😮', '👏', '😤'];
const REASONS = ['Spam or scam', 'Harassment or bullying', 'Hate speech', 'Sexual content', 'Something else'];

export function MessageMenu({ message, onClose, onOpenFan }: { message: ChatEntry | null; onClose: () => void; onOpenFan: (id: string) => void }) {
  const react = useUserStore((s) => s.react);
  const report = useUserStore((s) => s.report);
  const block = useUserStore((s) => s.block);
  const del = useUserStore((s) => s.deleteMessage);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const [reporting, setReporting] = useState(false);
  const close = () => { setReporting(false); onClose(); };
  if (!message) return null;
  const isFan = !message.isMine && message.userId.startsWith('fan_');
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
          <Text style={styles.quote} numberOfLines={3}>“{message.body}”</Text>
          {!isGuest && (
            <View style={styles.emojiRow}>
              {QUICK_EMOJI.map((e) => (
                <Pressable key={e} onPress={() => { react(message.id, e); close(); }} style={styles.emojiBtn} accessibilityRole="button" accessibilityLabel={`React ${e}`}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {isFan ? <Button label="View profile" icon="person-circle-outline" variant="secondary" onPress={() => { close(); onOpenFan(message.userId); }} /> : null}
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
  sheetText: { ...type.body, color: colors.textDim },
  quote: { ...type.body, color: colors.textDim, fontStyle: 'italic' },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  emojiBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
});
