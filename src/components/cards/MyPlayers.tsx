// The "My players" part of the Cards tab: your chosen player and team cards,
// what each is scoring right now, what it has earned, and buttons to choose more.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { competitorById } from '@/data/api';
import { cardGames, cardNextGame } from '@/data/demo/cardEarnings';
import { playerById } from '@/data/playerApi';
import type { OwnedCard } from '@/data/types';
import { useNow } from '@/hooks/useNow';
import { formatDay, formatNumber, formatTime } from '@/lib/format';
import { isChosen } from '@/logic/cards';
import { fantasyTix, formatPoints } from '@/logic/fantasy';
import { PLAYER_CARD_TIX, TEAM_CARD_TIX } from '@/logic/rules';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { Button } from '../ui/Button';
import { LiveDot } from '../ui/LiveDot';
import { StatTile, Surface } from '../ui/Misc';
import { AnyCard } from './CardFaces';

function CardRow({ card, now }: { card: OwnedCard; now: number }) {
  const router = useRouter();
  const latest = useMemo(() => cardGames(card, now, 1)[0] ?? null, [card, now]);
  const next = useMemo(() => (latest?.live ? null : cardNextGame(card, now)), [card, now, latest]);
  const player = card.kind === 'player' ? playerById(card.playerId) : undefined;
  const team = competitorById(card.competitorId);
  const name = player?.name ?? team?.name ?? 'Unknown';
  const sub = player ? `${player.posLabel}${player.teamId ? ` · ${competitorById(player.teamId)?.shortName ?? ''}` : ''}` : 'Team card · top 3 players';
  return (
    <Pressable onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })} accessibilityRole="button"
      accessibilityLabel={`${name}, earned ${card.earned ?? 0} Tix`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <AnyCard card={card} width={76} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
        {latest?.live ? (
          <View style={styles.liveRow}>
            <LiveDot />
            <Text style={styles.live} numberOfLines={1}>Live: {formatPoints(latest.points)} pts → {fantasyTix(latest.points)} Tix</Text>
          </View>
        ) : latest ? (
          <Text style={styles.sub} numberOfLines={1}>Last game: {formatPoints(latest.points)} pts · +{latest.tix} Tix</Text>
        ) : null}
        {next ? <Text style={styles.sub} numberOfLines={1}>Next: {formatDay(next.startsAt)} {formatTime(next.startsAt)}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.earned}>{formatNumber(card.earned ?? 0)}</Text>
        <Text style={styles.earnedLabel}>TIX EARNED</Text>
      </View>
    </Pressable>
  );
}

export function MyPlayersView() {
  const router = useRouter();
  const now = useNow(15_000);
  const cards = useUserStore((s) => s.cards);
  const freeUsed = useUserStore((s) => s.freePlayerUsed);
  const chosen = useMemo(() => cards.filter(isChosen).sort((a, b) => Number(b.kind === 'team') - Number(a.kind === 'team') || b.acquiredAt - a.acquiredAt), [cards]);
  const earned = chosen.reduce((a, c) => a + (c.earned ?? 0), 0);
  const players = chosen.filter((c) => c.kind === 'player').length;

  return (
    <FlatList
      data={chosen}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.body}
      ListHeaderComponent={
        <View style={{ gap: space.md }}>
          <Surface style={{ gap: space.sm }}>
            <Text style={styles.title}>Your players earn you Tix</Text>
            <Text style={styles.text}>
              Choose players and teams from any sport. After every game, a player card pays its player&rsquo;s fantasy points, rounded, in Tix.
              A team card pays the combined points of the team&rsquo;s 3 best players.
            </Text>
            <View style={styles.buttons}>
              <Button label={freeUsed ? `Choose a player · ${PLAYER_CARD_TIX} Tix` : 'Choose a player · first one free'} icon="person-add"
                onPress={() => router.push({ pathname: '/pick', params: { mode: 'players' } })} />
              <Button label={`Choose a team · ${TEAM_CARD_TIX} Tix`} icon="shield" variant="secondary"
                onPress={() => router.push({ pathname: '/pick', params: { mode: 'teams' } })} />
            </View>
          </Surface>
          {chosen.length > 0 ? (
            <View style={styles.tiles}>
              <StatTile label="Players" value={String(players)} />
              <StatTile label="Teams" value={String(chosen.length - players)} />
              <StatTile label="Tix earned" value={formatNumber(earned, true)} accent />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No player or team cards yet. Your first player card is free — pick anyone you like.</Text>}
      renderItem={({ item }) => <CardRow card={item} now={now} />}
    />
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.sm, paddingBottom: 60 },
  title: { ...type.title, color: colors.text },
  text: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
  buttons: { gap: space.sm, marginTop: space.xs },
  tiles: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { ...type.label, color: colors.textDim, fontWeight: '500' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  live: { ...type.label, color: colors.live },
  earned: { fontFamily: fonts.heavy, fontSize: 22, color: colors.accent },
  earnedLabel: { ...type.label, fontSize: 9, color: colors.textDim },
  empty: { ...type.body, color: colors.textDim, textAlign: 'center', marginTop: space.lg },
});
