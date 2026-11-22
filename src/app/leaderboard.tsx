import { Leaderboard } from '@/components/Leaderboard';
import { Header, Screen } from '@/components/ui/Screen';

export default function LeaderboardScreen() {
  return (
    <Screen>
      <Header title="Weekly leaderboard" subtitle="Clout won from Calls in the last 7 days" back />
      <Leaderboard />
    </Screen>
  );
}
