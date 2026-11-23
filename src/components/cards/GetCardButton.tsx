// "Get this card" for a player or a team. Your first player card is free, then
// every player card is 200 Tix and every team card 600 Tix. Owned cards show
// the Tix they have earned instead.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { competitorById } from '@/data/api';
import { playerById, recentAverage, rosterFor } from '@/data/playerApi';
import { useAccountGate } from '@/hooks/useAccountGate';
import { currentTime } from '@/lib/format';
import { tapError, tapSuccess } from '@/lib/haptics';
import { formatPoints } from '@/logic/fantasy';
import { TEAM_CARD_TIX } from '@/logic/rules';
import { toast } from '@/store/toast';
import { playerCardPrice, useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

import { Button } from '../ui/Button';
import { Surface } from '../ui/Misc';

export function GetCardButton({ playerId, teamId }: { playerId?: string; teamId?: string }) {
  const router = useRouter();
  const { require } = useAccountGate();
  const cards = useUserStore((s) => s.cards);
  const tix = useUserStore((s) => s.tix);
  const freeUsed = useUserStore((s) => s.freePlayerUsed);
  const getPlayerCard = useUserStore((s) => s.getPlayerCard);
  const getTeamCard = useUserStore((s) => s.getTeamCard);
  const player = playerId ? playerById(playerId) : undefined;
  const team = teamId ? competitorById(teamId) : undefined;
  const average = useMemo(() => (playerId ? recentAverage(playerId, currentTime()) : null), [playerId]);

  if (!player && !team) return null;
  if (team && rosterFor(team.id).length === 0) return null;
  const owned = cards.find((c) => (player ? c.kind === 'player' && c.playerId === player.id : c.kind === 'team' && c.competitorId === team?.id));
  const name = player ? player.short : team?.name ?? '';

  if (owned) {
    return (
      <Surface style={styles.box}>
        <Text style={styles.title}>✓ You own the {name} {player ? 'player' : 'team'} card</Text>
        <Text style={styles.body}>It has earned {owned.earned ?? 0} Tix so far. It earns again after every game that starts while you hold it.</Text>
        <Button label="View card" icon="albums" variant="secondary" small onPress={() => router.push({ pathname: '/card/[id]', params: { id: owned.id } })} />
      </Surface>
    );
  }

  const price = player ? playerCardPrice({ freePlayerUsed: freeUsed }) : TEAM_CARD_TIX;
  const short = Math.max(0, price - tix);
  const get = () => {
    if (!require('collect Stand Cards')) return;
    const r = player ? getPlayerCard(player.id, currentTime()) : getTeamCard(team!.id, currentTime());
    if ('error' in r) { tapError(); toast(r.error, 'error'); return; }
    tapSuccess();
    toast(r.price === 0 ? `Your free ${name} card is in your collection!` : `${name} card added · −${r.price} Tix`, 'success');
  };
  return (
    <Surface style={styles.box}>
      <Text style={styles.title}>{player ? `${name} player card` : `${name} team card`}</Text>
      <Text style={styles.body}>
        {player
          ? `Earns ${name}'s fantasy points, rounded, in Tix after every game.${average ? ` Recent average: ${formatPoints(average)} points a game.` : ''}`
          : `Earns the combined fantasy points of the team's 3 best players, rounded, in Tix after every game.`}
      </Text>
      {player && price === 0 ? <Text style={[styles.body, { color: colors.win }]}>Your first player card is free.</Text> : null}
      <Button label={short > 0 ? `You need ${short} more Tix` : price === 0 ? 'Get card · Free' : `Get card · ${price} Tix`}
        icon="add-circle" disabled={short > 0} onPress={get} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
});
