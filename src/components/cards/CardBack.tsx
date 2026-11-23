// The back of a Stand Card, like the back of a real trading card: the checklist
// number and set, a short bio, the ratings with bars, this season's live stats,
// the game a Game Day card comes from, how many copies exist, and the fine print.
import { StyleSheet, Text, View } from 'react-native';

import {
  championshipRow, competitorById, fightRecord, getFinalState, leagueName, ordinal, standingsKind, teamRow,
} from '@/data/api';
import { cardFace, circulation, productionCode, SET_NAME } from '@/data/demo/cardFacts';
import { SEASON } from '@/data/demo/cards';
import type { OwnedCard } from '@/data/types';
import { useCompetitor } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { clamp, formatTime } from '@/lib/format';
import { rarityLabel } from '@/logic/cards';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { FormStrip } from '../standings/StandingsTable';
import { foilSerial } from './StandCard';

/** This season's numbers, by sport shape. */
function seasonLine(competitorId: string, now: number): { label: string; value: string }[] {
  const c = competitorById(competitorId);
  if (!c) return [];
  const kind = standingsKind(c.sportId);
  if (kind === 'table' || kind === 'pct') {
    const r = teamRow(competitorId, now);
    if (!r) return [];
    return [
      { label: 'POS', value: ordinal(r.position) },
      { label: 'P', value: String(r.played) },
      { label: r.drawn > 0 ? 'W-D-L' : 'W-L', value: r.drawn > 0 ? `${r.won}-${r.drawn}-${r.lost}` : `${r.won}-${r.lost}` },
      kind === 'pct' ? { label: 'PCT', value: r.pct.toFixed(3).replace(/^0/, '') } : { label: 'PTS', value: String(r.points) },
      { label: 'STRK', value: r.streak },
    ];
  }
  if (kind === 'championship') {
    const r = championshipRow(competitorId, now);
    if (!r) return [];
    return [
      { label: 'POS', value: `P${r.position}` }, { label: 'PTS', value: String(r.points) },
      { label: 'WINS', value: String(r.wins) }, { label: 'PODS', value: String(r.podiums) },
    ];
  }
  if (c.kind !== 'athlete') return [];
  const r = fightRecord(c);
  return [
    { label: 'REC', value: `${r.won}-${r.lost}-${r.drawn}` }, { label: 'FIN', value: String(r.finishes) },
    { label: 'RANK', value: r.ranking === 1 ? 'C' : r.ranking ? `#${r.ranking - 1}` : 'NR' },
  ];
}

export function CardBack({ card, width }: { card: OwnedCard; width: number }) {
  const now = useNow(60_000);
  const mintCounts = useUserStore((s) => s.mintCounts);
  const face = cardFace(card.competitorId, now);
  const c = face?.competitor;
  const frame = colors.rarity[card.rarity];
  const s = width / 150;
  const fs = clamp(8 * s, 8, 12);
  const finish = card.finish ?? 'base';
  const gameDay = !!card.eventId;
  const team = c?.parentId ? competitorById(c.parentId) : undefined;
  const stats = seasonLine(card.competitorId, now);
  const form = c && (standingsKind(c.sportId) === 'table' || standingsKind(c.sportId) === 'pct') ? teamRow(c.id, now)?.form ?? [] : [];
  const circ = circulation(card.templateId, finish, card.eventId ?? null, mintCounts);
  const game = card.eventId ? getFinalState(card.eventId) : null;
  const page = useCompetitor(card.competitorId);
  const next = page.data?.upcoming.find((e) => e.status === 'scheduled' || e.status === 'live');
  const recent = c && standingsKind(c.sportId) === 'championship' ? championshipRow(c.id, now)?.recent ?? [] : [];
  const gameOver = game ? now >= game.endsAt : false;

  return (
    <View style={[styles.card, { width, height: width * 1.4, borderColor: frame }]} accessibilityLabel={`Back of the ${c?.name ?? ''} card`}>
      <View style={[styles.band, { backgroundColor: frame, paddingHorizontal: 6 * s, paddingVertical: 3 * s }]}>
        <Text style={[styles.bandCode, { fontSize: fs + 2 }]}>{face?.checklist ?? ''}</Text>
        <Text style={[styles.bandText, { fontSize: fs }]} numberOfLines={1}>{SET_NAME.toUpperCase()}</Text>
      </View>

      <View style={[styles.body, { padding: 6 * s, gap: 4 * s }]}>
        <View style={styles.head}>
          <CompetitorBadge id={card.competitorId} size={30 * s} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { fontSize: clamp(13 * s, 12, 20) }]} numberOfLines={1}>{c?.name ?? 'Unknown'}</Text>
            <Text style={[styles.bio, { fontSize: fs }]} numberOfLines={1}>
              {[face?.role, team?.name ?? (c ? leagueName(c.sportId) : null), c?.home].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[styles.ovr, { paddingHorizontal: 5 * s }]}>
            <Text style={[styles.ovrNum, { fontSize: clamp(18 * s, 16, 30) }]}>{face?.rating ?? '–'}</Text>
            <Text style={[styles.ovrLabel, { fontSize: fs - 1 }]}>OVR</Text>
          </View>
        </View>

        {face?.form ? (
          <Text style={[styles.form, { fontSize: fs }]} numberOfLines={1}>▲ IN FORM +{face.form.boost} · {face.form.reason}</Text>
        ) : null}

        <View style={styles.attrs}>
          {face?.attributes.map((a) => (
            <View key={a.label} style={styles.attr}>
              <Text style={[styles.attrLabel, { fontSize: fs }]}>{a.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${a.value}%`, backgroundColor: a.value >= 85 ? colors.win : a.value >= 70 ? colors.accent : colors.loss }]} />
              </View>
              <Text style={[styles.attrValue, { fontSize: fs + 1 }]}>{a.value}</Text>
            </View>
          ))}
        </View>

        {stats.length > 0 ? (
          <View style={styles.season}>
            <Text style={[styles.sectionLabel, { fontSize: fs - 0.5 }]}>{SEASON} SEASON · LIVE</Text>
            <View style={styles.statRow}>
              {stats.map((st) => (
                <View key={st.label} style={styles.stat}>
                  <Text style={[styles.statValue, { fontSize: fs + 2 }]}>{st.value}</Text>
                  <Text style={[styles.statLabel, { fontSize: fs - 1 }]}>{st.label}</Text>
                </View>
              ))}
            </View>
            {form.length > 0 && width >= 180 ? <View style={{ alignItems: 'center', marginTop: 2 }}><FormStrip form={form} size={clamp(12 * s, 12, 18)} /></View> : null}
            {recent.length > 0 && width >= 180 ? (
              <View style={styles.recentRow}>
                <Text style={[styles.recentLabel, { fontSize: fs - 1 }]}>LAST {recent.length}</Text>
                {recent.map((p, i) => (
                  <View key={i} style={[styles.recentChip, p === 1 && { backgroundColor: colors.gold }, p > 1 && p <= 3 && { backgroundColor: colors.silver }]}>
                    <Text style={[styles.recentText, { fontSize: fs, color: p <= 3 ? '#0A0E17' : colors.text }]}>P{p}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {next && width >= 180 ? (
          <Text style={[styles.next, { fontSize: fs }]} numberOfLines={1}>
            {next.status === 'live' ? '● LIVE NOW' : 'NEXT'} · {next.meta.title}
            {next.status === 'live' ? '' : ` · ${new Date(next.meta.startsAt).toLocaleDateString([], { weekday: 'short' })} ${formatTime(next.meta.startsAt)}`}
          </Text>
        ) : null}

        {game ? (
          <Text style={[styles.game, { fontSize: fs }]} numberOfLines={2}>
            GAME DAY · {game.meta.title}{gameOver && game.resultText ? ` · ${game.resultText}` : ' · result to come'}
          </Text>
        ) : null}
      </View>

      <View style={[styles.foot, { paddingHorizontal: 6 * s, paddingBottom: 5 * s }]}>
        <View style={styles.serialRow}>
          <Text style={[styles.serial, { fontSize: fs + 1, color: frame }]}>
            {rarityLabel(card.rarity).toUpperCase()}{finish === 'holo' ? ' HOLO' : ''} {foilSerial(card.serial, circ.run)}
          </Text>
          <Text style={[styles.minted, { fontSize: fs - 1 }]}>
            {circ.run ? `${Math.min(circ.minted, circ.run)} of ${circ.run} pulled` : `${circ.minted.toLocaleString()} pulled`}
          </Text>
        </View>
        <Text style={[styles.fine, { fontSize: clamp(6.5 * s, 7, 9) }]} numberOfLines={2}>
          © {SEASON} Stands · Preview season: teams, athletes and results are simulated. {c ? productionCode(c, card.rarity, finish, gameDay) : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 2, backgroundColor: '#101726', overflow: 'hidden', justifyContent: 'space-between' },
  band: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  bandCode: { fontFamily: fonts.black, color: '#0A0E17', letterSpacing: 0.5 },
  bandText: { fontFamily: fonts.heavy, color: '#0A0E17', letterSpacing: 0.6, flexShrink: 1 },
  body: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.black, color: colors.text, textTransform: 'uppercase' },
  bio: { fontFamily: fonts.semibold, color: colors.textDim },
  ovr: { alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 4, backgroundColor: colors.surface },
  ovrNum: { fontFamily: fonts.black, color: colors.text, fontVariant: ['tabular-nums'] },
  ovrLabel: { fontFamily: fonts.bold, color: colors.textDim, letterSpacing: 0.8, marginTop: -2 },
  form: { fontFamily: fonts.heavy, color: colors.win, letterSpacing: 0.4 },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  attr: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1 },
  attrLabel: { fontFamily: fonts.bold, color: colors.textDim, width: 30, letterSpacing: 0.4 },
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  attrValue: { fontFamily: fonts.heavy, color: colors.text, width: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },
  season: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 3 },
  sectionLabel: { fontFamily: fonts.heavy, color: colors.textDim, letterSpacing: 1, textAlign: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 1 },
  stat: { alignItems: 'center' },
  statValue: { fontFamily: fonts.heavy, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: fonts.bold, color: colors.textDim, letterSpacing: 0.6 },
  game: { fontFamily: fonts.bold, color: '#FF8A95', letterSpacing: 0.3 },
  next: { fontFamily: fonts.bold, color: colors.text, letterSpacing: 0.3, opacity: 0.85 },
  recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 3 },
  recentLabel: { fontFamily: fonts.bold, color: colors.textDim, letterSpacing: 0.6 },
  recentChip: { borderRadius: 3, paddingHorizontal: 4, backgroundColor: colors.surfaceHigh },
  recentText: { fontFamily: fonts.heavy, fontVariant: ['tabular-nums'] },
  foot: { gap: 2 },
  serialRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 },
  serial: { fontFamily: fonts.black, letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  minted: { fontFamily: fonts.semibold, color: colors.textDim },
  fine: { color: colors.loss, lineHeight: undefined },
});
