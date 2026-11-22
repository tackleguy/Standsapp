// Gate Check: tap once a day for Clout and Tix. Shows the streak.
import { StyleSheet, Text, View } from 'react-native';

import { useAccountGate } from '@/hooks/useAccountGate';
import { useNow } from '@/hooks/useNow';
import { DAY, timeUntil, utcDayKey } from '@/lib/format';
import { tapSuccess } from '@/lib/haptics';
import { canGateCheck, streakAlive } from '@/logic/gateCheck';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { Button } from './ui/Button';

export function GateCheckCard() {
  const now = useNow(30_000);
  const last = useUserStore((s) => s.lastGateCheck);
  const streak = useUserStore((s) => s.streakDays);
  const check = useUserStore((s) => s.gateCheck);
  const { require } = useAccountGate();
  const today = utcDayKey(now);
  const ready = canGateCheck(last, today);
  const alive = streakAlive(last, today);
  const nextStreak = alive ? streak + (ready ? 1 : 0) : 1;
  const nextReset = Math.floor(now / DAY) * DAY + DAY;

  const onPress = () => {
    if (!require('collect your Gate Check')) return;
    const r = check(Date.now());
    if ('error' in r) { toast(r.error, 'error'); return; }
    tapSuccess();
    toast(`Gate Check! +${r.clout} Clout, +${r.tix} Tix · ${r.streakDays}-day streak`, 'success');
  };

  return (
    <View style={[styles.card, ready && styles.ready]}>
      <View style={styles.row}>
        <Text style={styles.title}>Gate Check</Text>
        <Text style={styles.streak}>🔥 {alive ? streak : 0}-day streak</Text>
      </View>
      <View style={styles.dots}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={[styles.dot, i < Math.min(7, alive ? streak : 0) && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.body}>
        {ready ? `Check in now for ${100 + Math.min(nextStreak, 7) * 10} Clout and ${10 + Math.min(nextStreak, 7)} Tix. Bigger streak, bigger bonus.`
          : `Checked in today. Next Gate Check ${timeUntil(nextReset, now)}.`}
      </Text>
      <Button label={ready ? 'Check in' : 'Done for today'} icon={ready ? 'ticket' : 'checkmark-done'} disabled={!ready} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: space.lg, marginBottom: 0, padding: space.lg, gap: space.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ready: { borderColor: colors.accent },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.title, color: colors.text },
  streak: { ...type.label, color: colors.accent },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh },
  dotOn: { backgroundColor: colors.accent },
  body: { ...type.body, color: colors.textDim },
});
