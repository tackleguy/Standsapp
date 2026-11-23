// A Call: options as big buttons with multipliers, a stake picker, and the payout line.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { callCrowd } from '@/data/api';
import type { CallOption, CallView } from '@/data/types';
import { currentTime, formatMultiplier, formatNumber, timeUntil } from '@/lib/format';
import { tapError, tapMedium } from '@/lib/haptics';
import { potentialPayout } from '@/logic/predictions';
import { CLOUT_DISCLAIMER, STAKE_MIN } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore, type Prediction } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { StatusPill } from '../ui/LiveDot';
import { StakePicker } from './StakePicker';

interface CallCardProps {
  call: CallView;
  eventTitle: string;
  sportId: string;
  now: number;
  onNeedAccount: () => boolean;
  showEvent?: boolean;
  onOpenEvent?: () => void;
}

function statusText(call: CallView, now: number): { label: string; live?: boolean } {
  if (call.status === 'open') return { label: call.livePriced ? `In-play · closes ${timeUntil(call.closesAt, now)}` : `Closes ${timeUntil(call.closesAt, now)}`, live: call.livePriced };
  if (call.status === 'closed') return { label: 'Closed · waiting for result' };
  if (call.status === 'settled') return { label: 'Settled' };
  if (call.status === 'void') return { label: 'Void · stakes refunded' };
  return { label: 'Opens soon' };
}

export function CallCard({ call, eventTitle, sportId, now, onNeedAccount, showEvent, onOpenEvent }: CallCardProps) {
  const clout = useUserStore((s) => s.clout);
  const mine = useUserStore((s) => s.predictions.find((p) => p.callId === call.id));
  const place = useUserStore((s) => s.placePrediction);
  const [selected, setSelected] = useState<string | null>(null);
  const [stake, setStake] = useState(50);
  const option = call.options.find((o) => o.id === selected) ?? null;
  const status = statusText(call, now);
  const crowd = callCrowd(call, sportId, Math.min(now, call.closesAt));

  const confirm = () => {
    if (!option || !onNeedAccount()) return;
    const err = place({ call, option, options: call.options, stake, eventTitle, sportId, now: currentTime() });
    if (err) { tapError(); toast(err, 'error'); return; }
    tapMedium();
    toast(`Call made: ${option.label} for ${stake} Clout`, 'success');
    setSelected(null);
  };

  return (
    <View style={styles.card}>
      {showEvent ? (
        <Pressable onPress={onOpenEvent} accessibilityRole="button" accessibilityLabel={`Open ${eventTitle}`}>
          <Text style={styles.event} numberOfLines={1}>{eventTitle} ›</Text>
        </Pressable>
      ) : null}
      <View style={styles.head}>
        <Text style={styles.q}>{call.question}</Text>
        <View style={styles.metaRow}>
          <StatusPill label={status.label} live={status.live} />
          {crowd.total > 0 ? (
            <View style={styles.crowd}>
              <Icon name="people" size={13} color={colors.textDim} />
              <Text style={styles.crowdText}>{formatNumber(crowd.total + (mine ? 1 : 0))} called it</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.options}>
        {call.options.map((o) => (
          <OptionButton key={o.id} option={o} call={call} mine={mine} selected={selected === o.id}
            share={crowd.total > 0 ? crowd.shares[o.id] ?? 0 : null}
            onPress={() => {
              if (call.status !== 'open' || mine) return;
              setSelected(selected === o.id ? null : o.id);
              if (clout < stake) setStake(Math.max(STAKE_MIN, Math.min(clout, 50)));
            }} />
        ))}
      </View>

      {mine ? <MyCall p={mine} /> : null}

      {option && call.status === 'open' && !mine ? (
        <View style={styles.stakeBox}>
          <StakePicker value={stake} onChange={setStake} balance={clout} />
          <Text style={styles.win}>You could win <Text style={styles.winNum}>{formatNumber(potentialPayout(stake, option.multiplier))} Clout</Text></Text>
          <Button label={`Make the call · ${stake} Clout`} icon="flash" onPress={confirm} disabled={clout < STAKE_MIN} />
          <Text style={styles.small}>Balance {formatNumber(clout)} Clout. {CLOUT_DISCLAIMER}</Text>
        </View>
      ) : null}
    </View>
  );
}

function OptionButton({ option, call, mine, selected, share, onPress }: {
  option: CallOption; call: CallView; mine: Prediction | undefined; selected: boolean; share: number | null; onPress: () => void;
}) {
  const isWinner = call.winningOptionId === option.id;
  const isMine = mine?.optionId === option.id;
  const open = call.status === 'open' && !mine;
  return (
    <Pressable onPress={onPress} disabled={!open}
      accessibilityRole="button" accessibilityState={{ selected, disabled: !open }}
      accessibilityLabel={`${option.label}, ${formatMultiplier(option.multiplier)}${isWinner ? ', winner' : ''}${isMine ? ', your pick' : ''}`}
      style={({ pressed }) => [styles.opt, selected && styles.optOn, isWinner && styles.optWin, isMine && styles.optMine, pressed && open && styles.pressed]}>
      {share !== null && !selected ? <View style={[styles.shareBar, { width: `${share}%` }]} /> : null}
      {option.competitorId ? <CompetitorBadge id={option.competitorId} size={24} /> : null}
      <Text style={[styles.optLabel, selected && styles.optLabelOn]} numberOfLines={1}>{option.label}</Text>
      {isMine ? <Text style={styles.youTag}>YOU</Text> : null}
      {share !== null ? <Text style={[styles.share, selected && styles.optLabelOn]}>{share}%</Text> : null}
      <Text style={[styles.mult, selected && styles.optLabelOn]}>{formatMultiplier(option.multiplier)}</Text>
    </Pressable>
  );
}

function MyCall({ p }: { p: Prediction }) {
  const tone = p.status === 'won' ? colors.win : p.status === 'lost' ? colors.live : colors.accent;
  const text = p.status === 'open'
    ? `Your call: ${p.optionLabel} · ${p.stake} Clout at ${formatMultiplier(p.multiplier)} · could win ${formatNumber(potentialPayout(p.stake, p.multiplier))}`
    : p.status === 'won' ? `Won! +${formatNumber(p.payout ?? 0)} Clout on ${p.optionLabel}`
      : p.status === 'void' ? `Void. ${p.stake} Clout refunded.` : `Lost ${p.stake} Clout on ${p.optionLabel}`;
  return <View style={[styles.mine, { borderColor: tone }]}><Text style={[styles.mineText, { color: tone }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md, marginHorizontal: space.lg, marginBottom: space.md },
  event: { ...type.label, color: colors.accent },
  head: { gap: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  crowd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crowdText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim, fontVariant: ['tabular-nums'] },
  shareBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.05)' },
  share: { fontFamily: fonts.bold, fontSize: 14, color: colors.textDim, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },
  q: { ...type.title, fontSize: 18, color: colors.text },
  options: { gap: space.sm },
  opt: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingHorizontal: space.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  optOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optWin: { borderColor: colors.win, borderWidth: 2 },
  optMine: { borderColor: colors.accent, borderWidth: 2 },
  pressed: { opacity: 0.85 },
  optLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  optLabelOn: { color: colors.accentInk },
  youTag: { ...type.label, fontSize: 10, color: colors.accent },
  mult: { fontFamily: fonts.heavy, fontSize: 18, color: colors.accent, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
  stakeBox: { gap: space.md, paddingTop: space.sm, borderTopWidth: 1, borderColor: colors.line },
  win: { ...type.body, color: colors.text, textAlign: 'center' },
  winNum: { fontWeight: '900', color: colors.accent },
  small: { ...type.label, color: colors.textDim, textAlign: 'center', lineHeight: 16 },
  mine: { borderWidth: 1, borderRadius: radius.sm, padding: space.md },
  mineText: { ...type.label, fontSize: 13, lineHeight: 18 },
});
