// Create a free account: username, display name, and birth year (13+). Email is optional.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { tapSuccess } from '@/lib/haptics';
import { MIN_AGE } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

export default function AccountScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const router = useRouter();
  const profile = useUserStore((s) => s.profile);
  const create = useUserStore((s) => s.createAccount);
  const [username, setUsername] = useState(profile.isGuest ? '' : profile.username);
  const [displayName, setDisplayName] = useState(profile.isGuest ? '' : profile.displayName);
  const [year, setYear] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);

  if (!profile.isGuest) {
    return (
      <Screen><Header title="Your account" back />
        <Text style={styles.done}>You already have an account, @{profile.username}.</Text>
        <Button label="Back" onPress={() => router.back()} style={{ margin: space.lg }} />
      </Screen>
    );
  }

  const submit = () => {
    const birthYear = Number(year);
    const err = create({ username: username.trim().toLowerCase(), displayName, birthYear, email });
    if (err) {
      setError(err);
      if (err.includes(`${MIN_AGE} and over`)) setRefused(true);
      return;
    }
    tapSuccess();
    toast(`Welcome to the stands, ${displayName.trim()}!`, 'success');
    router.back();
  };

  if (refused) {
    return (
      <Screen><Header title="Create account" back />
        <Text style={styles.done}>Sorry, Stands accounts are for fans aged {MIN_AGE} and over. You can still browse scores as a guest.</Text>
        <Button label="Keep browsing" onPress={() => router.back()} style={{ margin: space.lg }} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Create a free account" subtitle={reason ? `Needed to ${reason}` : undefined} back />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>It takes ten seconds. You keep your 1,000 Clout and 50 Tix.</Text>
          <Field label="Username" value={username} onChangeText={(t) => { setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, '')); setError(null); }}
            placeholder="e.g. paddock_pete" autoCapitalize="none" autoCorrect={false} maxLength={20} />
          <Field label="Display name" value={displayName} onChangeText={(t) => { setDisplayName(t); setError(null); }} placeholder="e.g. Pete" maxLength={40} />
          <Field label="Birth year" value={year} onChangeText={(t) => { setYear(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(null); }}
            placeholder="e.g. 1994" keyboardType="number-pad" maxLength={4} />
          <Field label="Email (optional)" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Create account" icon="checkmark" onPress={submit} disabled={!username || !displayName || year.length !== 4} />
          <Text style={styles.small}>We only ask for your birth year to make sure you are {MIN_AGE} or older. Until Stands is connected to its database, your account lives on this device; email sign-in arrives with the database.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  lead: { ...type.body, color: colors.textDim },
  error: { ...type.body, color: '#FF8A95' },
  small: { ...type.label, color: colors.textDim, lineHeight: 17 },
  done: { ...type.body, color: colors.text, padding: space.lg },
});
