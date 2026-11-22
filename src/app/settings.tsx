// Settings: profile, motion and haptics, blocked users, and delete account.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field, Segmented, SectionHeading } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { getFan } from '@/data/api';
import { useSettingsStore, type MotionPref } from '@/store/settings';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const update = useUserStore((s) => s.updateProfile);
  const blocked = useUserStore((s) => s.blocked);
  const unblock = useUserStore((s) => s.unblock);
  const deleteAccount = useUserStore((s) => s.deleteAccount);
  const haptics = useSettingsStore((s) => s.haptics);
  const setHaptics = useSettingsStore((s) => s.setHaptics);
  const motion = useSettingsStore((s) => s.motion);
  const setMotion = useSettingsStore((s) => s.setMotion);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [confirm, setConfirm] = useState('');

  const save = () => {
    const err = update({ username, displayName });
    toast(err ?? 'Profile saved.', err ? 'error' : 'success');
  };

  return (
    <Screen>
      <Header title="Settings" back />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <SectionHeading title="Profile" />
        {profile.isGuest ? (
          <Button label="Create a free account" icon="person-add" onPress={() => router.push('/account')} />
        ) : (
          <View style={styles.group}>
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
            <Field label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))} autoCapitalize="none" maxLength={20} />
            <Button label="Save profile" small onPress={save} />
          </View>
        )}
        <SectionHeading title="Following" />
        <Button label="Edit sports, teams & athletes" variant="secondary" icon="star" onPress={() => router.push('/follows')} />

        <SectionHeading title="Motion & feel" />
        <Segmented<MotionPref> value={motion} onChange={setMotion}
          options={[{ value: 'system', label: 'Phone setting' }, { value: 'reduce', label: 'Reduce motion' }, { value: 'full', label: 'Full motion' }]} />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Haptic taps</Text>
          <Switch value={haptics} onValueChange={setHaptics} trackColor={{ true: colors.accent, false: colors.line }} accessibilityLabel="Haptic taps" />
        </View>

        <SectionHeading title={`Blocked · ${blocked.length}`} />
        {blocked.length === 0 ? <Text style={styles.muted}>You have not blocked anyone.</Text> : blocked.map((id) => (
          <View key={id} style={styles.switchRow}>
            <Text style={styles.label}>@{getFan(id)?.username ?? id}</Text>
            <Button label="Unblock" small variant="secondary" onPress={() => unblock(id)} />
          </View>
        ))}

        <SectionHeading title="About" />
        <Button label="Community rules" variant="ghost" onPress={() => router.push('/rules')} />
        <Button label="Privacy policy" variant="ghost" onPress={() => router.push('/privacy')} />
        <Text style={styles.muted}>Stands v1 · demo data mode. Scores, fans, and public Sections are simulated until real feeds and the database are connected.</Text>

        <SectionHeading title="Delete account" />
        <Text style={styles.muted}>This permanently erases your profile, Clout, Tix, Calls, cards, messages, and Sections from this device. Type DELETE to confirm.</Text>
        <Field label="Type DELETE" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="DELETE" />
        <Button label="Delete my account" icon="trash" variant="danger" disabled={confirm.trim() !== 'DELETE'}
          onPress={() => { deleteAccount(); toast('Your account has been deleted.', 'success'); }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingBottom: 80, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  group: { gap: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  label: { fontSize: 16, color: colors.text, fontWeight: '600' },
  muted: { ...type.body, color: colors.textDim },
});
