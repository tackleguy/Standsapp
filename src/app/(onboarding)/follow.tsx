import { StyleSheet, View } from 'react-native';

import { FollowPicker } from '@/components/FollowPicker';
import { Button } from '@/components/ui/Button';
import { Header, Screen } from '@/components/ui/Screen';
import { useUserStore } from '@/store/user';
import { colors, space } from '@/theme/tokens';

export default function PickTeams() {
  const sports = useUserStore((s) => s.followedSports);
  const count = useUserStore((s) => s.followedCompetitors.length);
  const done = useUserStore((s) => s.completeOnboarding);
  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Follow teams & athletes" subtitle="Step 2 of 2 · followed teams float to the top" back />
      <FollowPicker sportIds={sports} />
      <View style={styles.bottom}>
        <Button label={count === 0 ? 'Skip for now' : `Done · following ${count}`} variant={count === 0 ? 'secondary' : 'primary'}
          icon="checkmark" onPress={done} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.bg, borderTopWidth: 1, borderColor: colors.line },
});
