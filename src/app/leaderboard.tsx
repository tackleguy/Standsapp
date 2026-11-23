import { useLocalSearchParams } from 'expo-router';

import { Leaderboard } from '@/components/Leaderboard';
import { Header, Screen } from '@/components/ui/Screen';
import { totalPlayers } from '@/data/demo/ranking';
import { useNow } from '@/hooks/useNow';
import { formatNumber } from '@/lib/format';

/** Leaderboards: Clout won from Calls, or Tix earned by Stand Cards (`?board=cards`). */
export default function LeaderboardScreen() {
  const now = useNow(60_000);
  const { board } = useLocalSearchParams<{ board?: string }>();
  return (
    <Screen>
      <Header title="Leaderboards" subtitle={`${formatNumber(totalPlayers(now))} players · Calls and card earnings`} back />
      <Leaderboard showMetric initialMetric={board === 'cards' ? 'tix' : 'clout'} />
    </Screen>
  );
}
