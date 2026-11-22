import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FollowPicker } from '@/components/FollowPicker';
import { SportGrid } from '@/components/SportGrid';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { useUserStore } from '@/store/user';
import { space } from '@/theme/tokens';

export default function FollowsScreen() {
  const [tab, setTab] = useState<'sports' | 'teams'>('teams');
  const sports = useUserStore((s) => s.followedSports);
  const toggle = useUserStore((s) => s.toggleSport);
  return (
    <Screen>
      <Header title="Following" back />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'teams', label: 'Teams & athletes' }, { value: 'sports', label: 'Sports' }]} />
      </View>
      {tab === 'teams' ? <FollowPicker sportIds={sports} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}><SportGrid selected={sports} onToggle={toggle} /></ScrollView>
      )}
    </Screen>
  );
}
