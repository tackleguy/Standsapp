// Choose a player card or a team card, in any sport. Your first player card is
// free, then 200 Tix each; team cards are 600 Tix. Players are sorted by their
// recent fantasy points; tap a row to see their Performance page.
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { PlayerAvatar } from '@/components/players/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { sportIcon } from '@/components/ui/Icon';
import { Field, Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/StateViews';
import { SPORTS, sportById } from '@/config/sports';
import { competitorById, getWorld } from '@/data/api';
import { playersForSport, recentAverage, rosterFor, sportStats, type Player } from '@/data/playerApi';
import { useAccountGate } from '@/hooks/useAccountGate';
import { currentTime } from '@/lib/format';
import { tapError, tapSuccess } from '@/lib/haptics';
import { formatPoints } from '@/logic/fantasy';
import { PLAYER_CARD_TIX, TEAM_CARD_TIX } from '@/logic/rules';
import { toast } from '@/store/toast';
import { playerCardPrice, useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

type Mode = 'players' | 'teams';

interface Row { player: Player; avg: number }

function usePlayersWithAverages(sportId: string) {
  return useQuery({
    queryKey: ['pick-players', sportId, Math.floor(currentTime() / 600_000)],
    queryFn: () => new Promise<Row[]>((resolve) => {
      // Let the screen draw first; averages need a few days of games.
      setTimeout(() => {
        const now = currentTime();
        resolve(playersForSport(sportId).map((player) => ({ player, avg: recentAverage(player.id, now) }))
          .sort((a, b) => b.avg - a.avg || a.player.name.localeCompare(b.player.name)));
      }, 30);
    }),
  });
}

export default function PickScreen() {
  const params = useLocalSearchParams<{ mode?: string; sport?: string }>();
  const router = useRouter();
  const followed = useUserStore((s) => s.followedSports);
  const tix = useUserStore((s) => s.tix);
  const cards = useUserStore((s) => s.cards);
  const freeUsed = useUserStore((s) => s.freePlayerUsed);
  const getPlayerCard = useUserStore((s) => s.getPlayerCard);
  const getTeamCard = useUserStore((s) => s.getTeamCard);
  const { require } = useAccountGate();
  const [mode, setMode] = useState<Mode>(params.mode === 'teams' ? 'teams' : 'players');
  const [sport, setSport] = useState<string>(params.sport && sportById(params.sport) ? params.sport
    : followed.find((s) => sportById(s)) ?? 'american_football');
  const [pos, setPos] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'player' | 'team'; id: string; name: string; price: number } | null>(null);
  const rows = usePlayersWithAverages(sport);
  const def = sportStats(sport);
  const price = playerCardPrice({ freePlayerUsed: freeUsed });
  const ownedPlayers = useMemo(() => new Set(cards.filter((c) => c.kind === 'player').map((c) => c.playerId)), [cards]);
  const ownedTeams = useMemo(() => new Set(cards.filter((c) => c.kind === 'team').map((c) => c.competitorId)), [cards]);
  const teams = useMemo(() => (getWorld().bySport.get(sport) ?? []).filter((c) => c.kind === 'team' && rosterFor(c.id).length > 0), [sport]);

  const q = query.trim().toLowerCase();
  const shownPlayers = (rows.data ?? []).filter((r) => (!pos || r.player.pos === pos)
    && (!q || r.player.name.toLowerCase().includes(q) || (competitorById(r.player.teamId)?.name ?? '').toLowerCase().includes(q)));
  const shownTeams = teams.filter((t) => !q || t.name.toLowerCase().includes(q));

  const buy = () => {
    if (!confirm) return;
    if (!require('collect Stand Cards')) { setConfirm(null); return; }
    const r = confirm.kind === 'player' ? getPlayerCard(confirm.id, currentTime()) : getTeamCard(confirm.id, currentTime());
    setConfirm(null);
    if ('error' in r) { tapError(); toast(r.error, 'error'); return; }
    tapSuccess();
    toast(r.price === 0 ? `Your free ${confirm.name} card is in your collection!` : `${confirm.name} card added · −${r.price} Tix`, 'success');
  };

  return (
    <Screen>
      <Header title="Choose a card" subtitle={`${tix} Tix available`} back />
      <View style={styles.top}>
        <Segmented value={mode} onChange={(m) => { setMode(m); setPos(null); }} options={[
          { value: 'players', label: 'Players' }, { value: 'teams', label: 'Teams' },
        ]} />
        <Text style={styles.explain}>
          {mode === 'players'
            ? `${freeUsed ? `Player cards are ${PLAYER_CARD_TIX} Tix.` : `Your first player card is free, then ${PLAYER_CARD_TIX} Tix each.`} A player card earns its player's fantasy points, rounded, in Tix after every game.`
            : `Team cards are ${TEAM_CARD_TIX} Tix. A team card earns the combined fantasy points of the team's 3 best players in every game.`}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SPORTS.filter((s) => mode === 'players' || (getWorld().bySport.get(s.id) ?? []).some((c) => c.kind === 'team')).map((s) => (
            <Chip key={s.id} label={s.name} icon={sportIcon(s.id)} selected={sport === s.id} onPress={() => { setSport(s.id); setPos(null); }} />
          ))}
        </ScrollView>
        {mode === 'players' && def.positions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All positions" selected={pos === null} onPress={() => setPos(null)} />
            {def.positions.map((p) => <Chip key={p.pos} label={p.label} selected={pos === p.pos} onPress={() => setPos(p.pos)} />)}
          </ScrollView>
        ) : null}
        <Field label={mode === 'players' ? 'Search players or teams' : 'Search teams'} value={query} onChangeText={setQuery}
          placeholder="Type a name" autoCorrect={false} autoCapitalize="none" />
      </View>

      {mode === 'players' ? (
        rows.isLoading ? <Skeleton rows={6} height={56} /> : (
          <FlatList
            data={shownPlayers}
            keyExtractor={(r) => r.player.id}
            contentContainerStyle={styles.list}
            initialNumToRender={14}
            ListEmptyComponent={<Text style={styles.explain}>No players match.</Text>}
            renderItem={({ item }) => {
              const p = item.player;
              const team = competitorById(p.teamId);
              const owned = ownedPlayers.has(p.id);
              return (
                <Pressable onPress={() => router.push({ pathname: '/player/[id]', params: { id: p.id } })} accessibilityRole="button"
                  accessibilityLabel={`${p.name}, ${p.posLabel}, averaging ${formatPoints(item.avg)} fantasy points`}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
                  <PlayerAvatar playerId={p.id} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{[team?.shortName, p.posLabel, p.rookie ? 'Rookie' : null].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <View style={styles.avgBox}>
                    <Text style={styles.avg}>{formatPoints(item.avg)}</Text>
                    <Text style={styles.avgLabel}>AVG FPS</Text>
                  </View>
                  {owned ? <Text style={styles.owned}>Owned</Text> : (
                    <Pressable onPress={() => setConfirm({ kind: 'player', id: p.id, name: p.short, price })} accessibilityRole="button"
                      accessibilityLabel={`Get ${p.short}'s card for ${price === 0 ? 'free' : `${price} Tix`}`} style={styles.price}>
                      <Text style={styles.priceText}>{price === 0 ? 'Free' : price}</Text>
                    </Pressable>
                  )}
                </Pressable>
              );
            }}
          />
        )
      ) : (
        <FlatList
          data={shownTeams}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.explain}>No teams match.</Text>}
          renderItem={({ item }) => {
            const owned = ownedTeams.has(item.id);
            return (
              <Pressable onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: item.id } })} accessibilityRole="button"
                accessibilityLabel={item.name} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
                <CompetitorBadge id={item.id} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{sportById(item.sportId)?.name} · {rosterFor(item.id).length} players</Text>
                </View>
                {owned ? <Text style={styles.owned}>Owned</Text> : (
                  <Pressable onPress={() => setConfirm({ kind: 'team', id: item.id, name: item.name, price: TEAM_CARD_TIX })} accessibilityRole="button"
                    accessibilityLabel={`Get the ${item.name} card for ${TEAM_CARD_TIX} Tix`} style={styles.price}>
                    <Text style={styles.priceText}>{TEAM_CARD_TIX}</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <Sheet visible={!!confirm} onClose={() => setConfirm(null)} title={confirm ? `Get the ${confirm.name} card?` : ''}>
        <Text style={styles.sheetBody}>
          {confirm?.kind === 'player'
            ? `${confirm.price === 0 ? 'Free — it is your first player card.' : `${confirm.price} Tix.`} It earns ${confirm.name}'s fantasy points, rounded, in Tix after every game that starts from now on.`
            : `${confirm?.price ?? 0} Tix. It earns the combined fantasy points of the team's 3 best players in every game that starts from now on.`}
        </Text>
        <Button label={confirm && tix < confirm.price ? `You need ${confirm.price - tix} more Tix` : confirm?.price === 0 ? 'Get it free' : `Get it · ${confirm?.price ?? 0} Tix`}
          icon="add-circle" disabled={!!confirm && tix < confirm.price} onPress={buy} />
        <Button label="Not now" variant="secondary" onPress={() => setConfirm(null)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  explain: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
  chips: { gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: 60, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line, minHeight: 60 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { ...type.label, color: colors.textDim, marginTop: 2 },
  avgBox: { alignItems: 'flex-end' },
  avg: { fontFamily: fonts.heavy, fontSize: 18, color: colors.win },
  avgLabel: { ...type.label, fontSize: 9, color: colors.textDim },
  owned: { ...type.label, color: colors.win, width: 56, textAlign: 'center' },
  price: { minWidth: 56, minHeight: 36, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  priceText: { fontFamily: fonts.heavy, fontSize: 16, color: colors.accentInk },
  sheetBody: { ...type.body, color: colors.text },
});
