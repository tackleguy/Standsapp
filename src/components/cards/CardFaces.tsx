// The faces of the new card kinds, plus one component that draws any card.
// - Player and team cards (chosen): team-colour stock, the player or badge, and Tix earned.
// - Play and Performance cards (from packs): the moment's headline, the player,
//   the game and date, the play rating or fantasy points, rarity frame and serial.
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { competitorById } from '@/data/api';
import { momentById } from '@/data/demo/moments';
import { eventMetaById } from '@/data/demo/schedule';
import { playerById } from '@/data/playerApi';
import type { OwnedCard } from '@/data/types';
import { mix, readableOnDark } from '@/lib/color';
import { rarityLabel } from '@/logic/cards';
import { formatPoints } from '@/logic/fantasy';
import { printRun } from '@/logic/rules';
import { colors, fonts, radius } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { Icon, sportIcon } from '../ui/Icon';
import { FOIL, foilSerial, Sheen, StandCard, Stock } from './StandCard';

interface FaceProps {
  card: OwnedCard;
  width?: number;
  count?: number;
  favorite?: boolean;
  animated?: boolean;
}

const kitOf = (competitorId: string | null | undefined): [string, string] => {
  const c = competitorById(competitorId);
  const pair = c?.colors ?? competitorById(c?.parentId)?.colors;
  return [readableOnDark(pair?.[0] ?? '#334155', 0.06), pair?.[1] ?? '#FFFFFF'];
};

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Player and team cards. */
function ChosenFaceImpl({ card, width = 150, favorite, animated }: FaceProps) {
  const height = width * 1.4;
  const s = width / 150;
  const tiny = width < 112;
  const isPlayer = card.kind === 'player';
  const player = isPlayer ? playerById(card.playerId) : undefined;
  const team = competitorById(isPlayer ? player?.teamId ?? player?.sideId : card.competitorId);
  const [primary, secondary] = kitOf(isPlayer ? player?.teamId ?? player?.sideId : card.competitorId);
  const plate = mix(primary, '#0B101B', 0.55);
  const frame = isPlayer ? colors.accent : colors.win;
  const name = isPlayer ? player?.name ?? 'Unknown' : team?.name ?? 'Unknown';
  const label = `${isPlayer ? 'Player' : 'Team'} card: ${name}. Earned ${card.earned ?? 0} Tix.${favorite ? ' Favorite.' : ''}`;
  return (
    <View style={[styles.card, { width, height, borderColor: frame, borderWidth: 3 }]} accessibilityLabel={label}>
      <Stock width={width} height={height} primary={primary} secondary={secondary} />
      <Sheen width={width} height={height} holo={false} animated={!!animated} tint={frame} />
      <View pointerEvents="none" style={styles.inner} />
      <View style={[styles.top, { padding: 7 * s }]}>
        <View style={[styles.kindPill, { backgroundColor: frame, paddingHorizontal: 5 * s }]}>
          <Text style={[styles.kindText, { fontSize: 8.5 * s }]}>{isPlayer ? 'PLAYER' : 'TEAM'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 * s }}>
          <Icon name={sportIcon(team?.sportId ?? player?.sportId ?? '')} size={12 * s} color={colors.text} />
          {isPlayer && player ? <Text style={[styles.pos, { fontSize: 11 * s }]}>{player.pos}{player.number !== null ? ` #${player.number}` : ''}</Text> : null}
        </View>
      </View>
      <View style={[styles.art, { top: height * 0.13, height: height * 0.46 }]} pointerEvents="none">
        {isPlayer && player
          ? <PlayerAvatar playerId={player.id} size={width * 0.62} badge={!tiny} />
          : <CompetitorBadge id={card.competitorId} size={width * 0.56} />}
      </View>
      <View style={styles.bottom}>
        <View style={[styles.plate, { backgroundColor: plate, borderColor: frame, paddingVertical: 4 * s, paddingHorizontal: 7 * s }]}>
          <Text style={[styles.name, { fontSize: (tiny ? 13 : 15) * s, lineHeight: (tiny ? 14 : 16) * s }]} numberOfLines={2}>{isPlayer ? player?.short ?? name : name}</Text>
          {!tiny ? <Text style={[styles.meta, { fontSize: 8.5 * s }]} numberOfLines={1}>{isPlayer ? `${player?.posLabel ?? ''}${team && team.id !== player?.id ? ` · ${team.shortName}` : ''}` : 'Top 3 players’ fantasy points'}</Text> : null}
        </View>
        <View style={[styles.footer, { paddingHorizontal: 7 * s, paddingBottom: 6 * s, paddingTop: 4 * s }]}>
          <Text style={[styles.earned, { fontSize: 10 * s }]} numberOfLines={1}>🎟 {card.earned ?? 0} EARNED</Text>
          <View style={[styles.serialBox, { backgroundColor: 'rgba(10,14,23,0.6)', borderColor: colors.line, paddingHorizontal: 4 * s }]}>
            <Text style={[styles.serial, { fontSize: 9 * s, color: colors.text }]}>#{card.serial}</Text>
          </View>
        </View>
      </View>
      {favorite ? <View style={[styles.fav, { top: height * 0.5 }]}><Icon name="star" size={Math.max(12, 13 * s)} color={colors.accent} /></View> : null}
    </View>
  );
}

/** Play and Performance cards. */
function MomentFaceImpl({ card, width = 150, count, favorite, animated }: FaceProps) {
  const moment = useMemo(() => momentById(card.templateId), [card.templateId]);
  const height = width * 1.4;
  const s = width / 150;
  const tiny = width < 112;
  const big = width >= 140;
  const player = playerById(card.playerId ?? moment?.playerId);
  const [primary, secondary] = kitOf(player?.teamId ?? card.competitorId);
  const frame = colors.rarity[card.rarity];
  const holo = card.finish === 'holo';
  const gameDay = !!card.eventId;
  const run = printRun(card.rarity, card.finish ?? 'base', gameDay);
  const foil = FOIL[card.rarity];
  const meta = eventMetaById(card.gameId ?? moment?.eventId ?? '');
  const isPlay = card.kind === 'play';
  const teams = meta && meta.competitorIds.length === 2 ? meta.competitorIds.map((id) => competitorById(id)?.shortName ?? '?').join(' v ') : meta?.title ?? '';
  const label = [
    `${rarityLabel(card.rarity)}${holo ? ' Holo' : ''} ${isPlay ? 'Play' : 'Performance'} card: ${moment?.headline ?? ''} by ${player?.name ?? 'Unknown'}`,
    meta ? `${meta.title}, ${shortDate(meta.startsAt)}` : null,
    `serial ${foilSerial(card.serial, run)}`,
    count && count > 1 ? `${count} copies` : null,
    favorite ? 'favorite' : null,
  ].filter(Boolean).join(', ');
  return (
    <View style={[styles.card, { width, height, borderColor: frame, borderWidth: card.rarity === 'legendary' || holo ? 3 : 2 }]} accessibilityLabel={label}>
      <Stock width={width} height={height} primary={primary} secondary={secondary} />
      {holo || card.rarity === 'epic' || card.rarity === 'legendary' ? <Sheen width={width} height={height} holo={holo} animated={!!animated} tint={frame} /> : null}
      <View pointerEvents="none" style={styles.inner} />
      <View style={[styles.top, { padding: 7 * s }]}>
        <View style={[styles.kindPill, { backgroundColor: 'rgba(10,14,23,0.7)', borderColor: frame, borderWidth: 1, paddingHorizontal: 5 * s }]}>
          <Text style={[styles.kindText, { fontSize: 8 * s, color: frame }]}>{isPlay ? 'PLAY' : 'PERFORMANCE'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 * s }}>
          <View style={[styles.rarityPill, { borderColor: frame, paddingHorizontal: 5 * s }]}>
            <Text style={[styles.rarityText, { color: frame, fontSize: 7.5 * s }]} numberOfLines={1}>{holo ? 'HOLO ' : ''}{rarityLabel(card.rarity).toUpperCase()}</Text>
          </View>
          <Icon name={sportIcon(meta?.sportId ?? player?.sportId ?? '')} size={11 * s} color={colors.text} />
        </View>
      </View>
      {gameDay ? (
        <View style={[styles.ribbon, { top: height * 0.115, paddingVertical: 1 * s }]}>
          <Text style={[styles.ribbonText, { fontSize: 7.5 * s }]} numberOfLines={1}>GAME DAY</Text>
        </View>
      ) : null}
      <View style={[styles.art, { top: height * 0.17, height: height * 0.34 }]} pointerEvents="none">
        {player ? <PlayerAvatar playerId={player.id} size={width * 0.5} badge={!tiny} /> : null}
      </View>
      <View style={styles.bottom}>
        <View style={[styles.headlineBox, { paddingHorizontal: 7 * s, paddingBottom: 3 * s }]}>
          <Text style={[styles.headline, { fontSize: (tiny ? 14 : big ? 19 : 16) * s, lineHeight: (tiny ? 15 : big ? 20 : 17) * s }]} numberOfLines={2}>
            {moment?.headline ?? (isPlay ? 'Play' : 'Performance')}
          </Text>
        </View>
        <View style={[styles.plate, { backgroundColor: mix(primary, '#0B101B', 0.55), borderColor: frame, paddingVertical: 3 * s, paddingHorizontal: 7 * s }]}>
          <Text style={[styles.name, { fontSize: (tiny ? 11 : 13) * s, lineHeight: (tiny ? 12 : 14) * s }]} numberOfLines={1}>{player?.short ?? 'Unknown'}</Text>
          {!tiny ? <Text style={[styles.meta, { fontSize: 8 * s }]} numberOfLines={1}>{teams}{meta ? ` · ${shortDate(meta.startsAt)}` : ''}</Text> : null}
        </View>
        <View style={[styles.footer, { paddingHorizontal: 7 * s, paddingBottom: 6 * s, paddingTop: 4 * s }]}>
          <Text style={[styles.value, { fontSize: (tiny ? 10 : 12) * s }]} numberOfLines={1}>
            {moment ? (isPlay ? `⚡ ${moment.value.toFixed(1)}` : `${formatPoints(moment.value)} FPS`) : ''}
          </Text>
          <View style={[styles.serialBox, { backgroundColor: run ? foil[0] : 'rgba(10,14,23,0.6)', borderColor: run ? foil[1] : colors.line, paddingHorizontal: 4 * s }]}>
            <Text style={[styles.serial, { fontSize: 9 * s, color: run ? '#0A0E17' : colors.text }]}>{foilSerial(card.serial, run)}</Text>
          </View>
        </View>
      </View>
      {count && count > 1 ? <View style={[styles.count, { top: height * 0.22 }]}><Text style={styles.countText}>×{count}</Text></View> : null}
      {favorite ? <View style={[styles.fav, { top: height * 0.45 }]}><Icon name="star" size={Math.max(12, 13 * s)} color={colors.accent} /></View> : null}
    </View>
  );
}

const ChosenFace = memo(ChosenFaceImpl);
const MomentFace = memo(MomentFaceImpl);

/** Draws any card the fan owns: player, team, play, performance or a classic team/athlete card. */
export function AnyCard({ card, width = 150, count, favorite, won, animated }: FaceProps & { won?: boolean }) {
  if (card.kind === 'player' || card.kind === 'team') return <ChosenFace card={card} width={width} favorite={favorite} animated={animated} />;
  if (card.kind === 'play' || card.kind === 'performance') {
    return <MomentFace card={card} width={width} count={count} favorite={favorite} animated={animated} />;
  }
  return (
    <StandCard competitorId={card.competitorId} rarity={card.rarity} serial={card.serial} width={width} finish={card.finish}
      eventId={card.eventId} count={count} favorite={favorite} won={won ?? card.wonGame} animated={animated} />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: '#0B101B', overflow: 'hidden' },
  inner: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md - 4 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  kindPill: { borderRadius: 4, paddingVertical: 1 },
  kindText: { fontFamily: fonts.black, color: '#0A0E17', letterSpacing: 0.8 },
  pos: { fontFamily: fonts.black, color: colors.text },
  rarityPill: { borderWidth: 1, borderRadius: 999, backgroundColor: 'rgba(10,14,23,0.6)' },
  rarityText: { fontFamily: fonts.heavy, letterSpacing: 0.8 },
  ribbon: { position: 'absolute', left: 6, right: 6, backgroundColor: colors.live, borderRadius: 3, alignItems: 'center' },
  ribbonText: { fontFamily: fonts.black, color: '#FFFFFF', letterSpacing: 0.8 },
  art: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  headlineBox: {},
  headline: { fontFamily: fonts.black, color: colors.text, textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  plate: { borderTopWidth: 1.5, borderBottomWidth: 1.5 },
  name: { fontFamily: fonts.black, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.2 },
  meta: { fontFamily: fonts.semibold, color: 'rgba(244,246,250,0.75)', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  earned: { fontFamily: fonts.heavy, color: colors.accent, letterSpacing: 0.4, flexShrink: 1 },
  value: { fontFamily: fonts.heavy, color: colors.text, flexShrink: 1 },
  serialBox: { borderRadius: 3, borderWidth: 1 },
  serial: { fontFamily: fonts.black, fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  count: { position: 'absolute', right: 4, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: colors.line },
  countText: { color: colors.text, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  fav: { position: 'absolute', left: 6 },
});
