import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SportGrid } from '@/components/SportGrid';
import { Button } from '@/components/ui/Button';
import { Header, Screen } from '@/components/ui/Screen';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

const DEFAULTS = ['f1', 'cricket', 'rugby_union'];

export default function PickSports() {
  const router = useRouter();
  const selected = useUserStore((s) => s.followedSports);
  const toggle = useUserStore((s) => s.toggleSport);
  const setAll = useUserStore((s) => s.setFollowedSports);

  useEffect(() => {
    if (useUserStore.getState().followedSports.length === 0) setAll(DEFAULTS);
  }, [setAll]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Pick your sports" subtitle="Step 1 of 2" back />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <Text style={styles.lead}>Choose as many as you like. You can change these any time.</Text>
        <SportGrid selected={selected} onToggle={toggle} />
      </ScrollView>
      <View style={styles.bottom}>
        <Button label={selected.length === 0 ? 'Pick at least one sport' : `Continue with ${selected.length} sport${selected.length > 1 ? 's' : ''}`}
          disabled={selected.length === 0} onPress={() => router.push('/follow')} icon="arrow-forward" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg, marginBottom: space.lg },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, paddingBottom: space.xl, backgroundColor: colors.bg, borderTopWidth: 1, borderColor: colors.line },
});
