// Card earnings: what your Stand Cards have earned (win bonuses, fantasy points,
// set rewards), what you spent on packs, your rank among collectors, the last
// seven days, your best earners, and every recent payout.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnyCard } from '@/components/cards/CardFaces';
import { EarningsChart } from '@/components/cards/EarningsChart';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionHeading, Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import { playerById } from '@/data/playerApi';
import { PERIODS, type Period } from '@/data/demo/ranking';
import { SEASON_START } from '@/data/demo/season';
import type { OwnedCard } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { useBoard, useMeInput } from '@/hooks/useRanking';
import { formatNumber, timeAgo } from '@/lib/format';
import { dailyEarnings, EARNING_SOURCES, earningsSummary, periodStart, recentEarnings, topEarners } from '@/logic/earnings';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

const PERIOD_WORD: Record<Period, string> = { today: 'today', week: 'in the last 7 days', season: 'this season' };

/** The name printed on any kind of card. */
function cardName(card: OwnedCard | undefined): string {
  if (!card) return 'A card you no longer own';
  if (card.playerId) return playerById(card.playerId)?.name ?? 'Player card';
  return competitorById(card.competitorId)?.name ?? 'Stand Card';
}

export default function EarningsScreen() {
  const router = useRouter();
  const now = useNow(15_000);
  const [period, setPeriod] = useState<Period>('week');
  const ledger = useUserStore((s) => s.ledger);
  const cards = useUserStore((s) => s.cards);
  const isGuest = useUserStore((s) => s.profile.isGuest);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const from = periodStart(period, now, SEASON_START);
  const summary = useMemo(() => earningsSummary(ledger, from, now), [ledger, from, now]);
  const days = useMemo(() => dailyEarnings(ledger, now, 7), [ledger, now]);
  const top = useMemo(() => topEarners(ledger, from, now, 6), [ledger, from, now]);
  const recent = useMemo(() => recentEarnings(ledger, 25), [ledger]);
  const me = useMeInput(period, null, true, now, 'tix');
  const board = useBoard(period, { kind: 'global' }, me, 'tix');
  const rank = board.data?.me?.rank ?? null;
  const maxSource = Math.max(1, ...EARNING_SOURCES.map((src) => summary.bySource[src.reason]));
  const everEarned = recent.length > 0;

  return (
    <Screen>
      <Header title="Card earnings" subtitle="Tix your Stand Cards earn" back />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View style={styles.seg}>
          <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>EARNED BY YOUR CARDS {PERIOD_WORD[period].toUpperCase()}</Text>
          <Text style={styles.heroValue}>+{formatNumber(summary.earned)}<Text style={styles.heroUnit}> TIX</Text></Text>
          <Text style={styles.heroSub}>
            {summary.payouts} payout{summary.payouts === 1 ? '' : 's'} · {cards.length} card{cards.length === 1 ? '' : 's'} in your collection
          </Text>
          <Pressable onPress={() => router.push({ pathname: '/leaderboard', params: { board: 'cards' } })} accessibilityRole="button"
            accessibilityLabel="Open the card earnings leaderboard" style={({ pressed }) => [styles.rankChip, pressed && { opacity: 0.85 }]}>
            <Icon name="podium" size={15} color={colors.accent} />
            <Text style={styles.rankText}>
              {isGuest ? 'Join free to get ranked among collectors'
                : rank ? `#${formatNumber(rank)} of ${formatNumber(board.data?.ranked ?? 0)} collectors`
                  : `Not ranked ${PERIOD_WORD[period]} yet · ${formatNumber(board.data?.ranked ?? 0)} collectors ranked`}
            </Text>
            <Icon name="chevron-forward" size={15} color={colors.textDim} />
          </Pressable>
        </View>

        <SectionHeading title="Last 7 days" />
        <View style={styles.card}><EarningsChart days={days} /></View>

        <SectionHeading title={`Where it came from · ${PERIODS.find((p) => p.id === period)?.label}`} />
        <View style={styles.card}>
          {EARNING_SOURCES.map((src) => {
            const amount = summary.bySource[src.reason];
            return (
              <View key={src.reason} style={styles.source}>
                <View style={styles.sourceIcon}><Icon name={src.icon as IconName} size={16} color={colors.accent} /></View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.sourceHead}>
                    <Text style={styles.sourceLabel}>{src.label}</Text>
                    <Text style={styles.sourceAmount}>+{formatNumber(amount)}</Text>
                  </View>
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((amount / maxSource) * 100)}%` }]} /></View>
                  <Text style={styles.sourceDetail}>{src.detail}</Text>
                </View>
              </View>
            );
          })}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Spent on packs and cards</Text>
            <Text style={[styles.totalValue, { color: colors.textDim }]}>−{formatNumber(summary.spent)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Net</Text>
            <Text style={[styles.totalValue, { color: summary.net >= 0 ? colors.win : colors.down }]}>
              {summary.net >= 0 ? '+' : '−'}{formatNumber(Math.abs(summary.net))} Tix
            </Text>
          </View>
        </View>

        <SectionHeading title="Top earners" />
        {top.length === 0 ? (
          <Text style={styles.muted}>No card has earned {PERIOD_WORD[period]} yet. Cards pay out when their team or player wins or scores.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topRow}>
            {top.map((t, i) => {
              const card = byId.get(t.cardId);
              return (
                <Pressable key={t.cardId} disabled={!card} onPress={() => router.push({ pathname: '/card/[id]', params: { id: t.cardId } })}
                  accessibilityRole="button" accessibilityLabel={`${cardName(card)}, earned ${t.total} Tix`} style={styles.topItem}>
                  {card ? <AnyCard card={card} width={104} /> : <View style={styles.gone}><Icon name="albums-outline" size={22} color={colors.textDim} /></View>}
                  <Text style={styles.topPlace}>#{i + 1}</Text>
                  <Text style={styles.topAmount}>+{formatNumber(t.total)} Tix</Text>
                  <Text style={styles.topMeta} numberOfLines={1}>{t.payouts} payout{t.payouts === 1 ? '' : 's'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <SectionHeading title="Recent payouts" />
        {!everEarned ? (
          <EmptyState icon="cash-outline" title="Your cards haven't earned yet"
            body="Every card earns Tix when its team or athlete wins. Player and team cards also earn their fantasy points after every game."
            actionLabel="Open the Pack Store" onAction={() => router.push('/pack')} />
        ) : recent.map((l) => {
          const src = EARNING_SOURCES.find((x) => x.reason === l.reason);
          const card = l.ref ? byId.get(l.ref) : undefined;
          const what = l.reason === 'set_reward' ? `${sportById(l.ref ?? '')?.name ?? 'A'} set complete`
            : l.reason === 'quick_sell' ? `${(l.ref ?? '').split(',').filter(Boolean).length || 1} card${(l.ref ?? '').includes(',') ? 's' : ''} sold`
              : cardName(card);
          return (
            <View key={l.id} style={styles.line}>
              <View style={styles.sourceIcon}><Icon name={(src?.icon ?? 'cash') as IconName} size={15} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineTitle} numberOfLines={1}>{what}</Text>
                <Text style={styles.lineMeta}>{src?.label ?? 'Earning'} · {timeAgo(l.at, now)}</Text>
              </View>
              <Text style={styles.lineAmount}>+{formatNumber(l.amount)}</Text>
            </View>
          );
        })}

        <View style={styles.cta}>
          <Button label="Card earnings leaderboard" icon="podium" variant="secondary"
            onPress={() => router.push({ pathname: '/leaderboard', params: { board: 'cards' } })} />
        </View>
        <Text style={styles.note}>Tix are free play points earned in the app. They can never be bought or cashed out, and cards have no cash value.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seg: { paddingHorizontal: space.lg, paddingTop: space.sm },
  hero: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.xl, gap: 4 },
  heroLabel: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.1, color: colors.textDim, textAlign: 'center' },
  heroValue: { fontFamily: fonts.black, fontSize: 64, lineHeight: 70, color: colors.accent, fontVariant: ['tabular-nums'] },
  heroUnit: { fontFamily: fonts.heavy, fontSize: 24, color: colors.accent },
  heroSub: { ...type.label, color: colors.textDim },
  rankChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, paddingHorizontal: space.md, minHeight: 40,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  rankText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, letterSpacing: 0.3 },
  card: { marginHorizontal: space.lg, padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, gap: space.md },
  source: { flexDirection: 'row', gap: space.md },
  sourceIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,182,39,0.12)', alignItems: 'center', justifyContent: 'center' },
  sourceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sourceLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  sourceAmount: { fontFamily: fonts.heavy, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  sourceDetail: { ...type.label, fontSize: 11, color: colors.textDim, letterSpacing: 0.2 },
  divider: { height: 1, backgroundColor: colors.line },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 14, fontWeight: '600', color: colors.textDim },
  totalValue: { fontFamily: fonts.heavy, fontSize: 18, fontVariant: ['tabular-nums'] },
  topRow: { gap: space.md, paddingHorizontal: space.lg },
  topItem: { alignItems: 'center', width: 104, gap: 2 },
  topPlace: { fontFamily: fonts.black, fontSize: 15, color: colors.textDim, marginTop: 4 },
  topAmount: { fontFamily: fonts.heavy, fontSize: 16, color: colors.accent, fontVariant: ['tabular-nums'] },
  topMeta: { ...type.label, fontSize: 11, color: colors.textDim },
  gone: { width: 104, height: 146, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  lineTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  lineMeta: { ...type.label, fontSize: 11, color: colors.textDim },
  lineAmount: { fontFamily: fonts.heavy, fontSize: 18, color: colors.win, fontVariant: ['tabular-nums'] },
  muted: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
  cta: { paddingHorizontal: space.lg, paddingTop: space.xl },
  note: { ...type.label, color: colors.textDim, textAlign: 'center', padding: space.lg, lineHeight: 17 },
});
