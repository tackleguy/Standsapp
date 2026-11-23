import { Leaderboard } from '@/components/Leaderboard';
import { Header, Screen } from '@/components/ui/Screen';
import { totalPlayers } from '@/data/demo/ranking';
import { useNow } from '@/hooks/useNow';
import { formatNumber } from '@/lib/format';

export default function LeaderboardScreen() {
  const now = useNow(60_000);
  return (
    <Screen>
      <Header title="Leaderboards" subtitle={`${formatNumber(totalPlayers(now))} players · ranked by Clout won from Calls`} back />
      <Leaderboard />
    </Screen>
  );
}
