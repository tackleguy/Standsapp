import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SPORTS } from '@/config/sports';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { sportIcon } from '../ui/Icon';
import { Field } from '../ui/Misc';
import { Sheet } from '../ui/Sheet';

export function CreateSectionSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const create = useUserStore((s) => s.createSection);
  const [name, setName] = useState('');
  const [sport, setSport] = useState('f1');
  const [isPublic, setPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const r = create(name, sport, isPublic, Date.now());
    if ('error' in r) { setError(r.error); return; }
    toast(`Section created. Invite code ${r.inviteCode}`, 'success');
    setName(''); setError(null);
    onCreated(r.id);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Create a Section">
      <Field label="Section name" value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="e.g. Sunday Paddock Club" maxLength={40} error={error} />
      <Text style={styles.label}>Main sport</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {SPORTS.map((s) => <Chip key={s.id} label={s.name} icon={sportIcon(s.id)} selected={sport === s.id} onPress={() => setSport(s.id)} />)}
      </ScrollView>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>Public Section</Text>
          <Text style={styles.label}>Public Sections can be found by anyone. Private ones need your invite code.</Text>
        </View>
        <Switch value={isPublic} onValueChange={setPublic} trackColor={{ true: colors.accent, false: colors.line }} accessibilityLabel="Public Section" />
      </View>
      <Button label="Create Section" icon="checkmark" onPress={submit} disabled={name.trim().length < 2} />
      <Text style={styles.label}>Until Stands is connected to its database, your Sections live on this device. Friends will be able to join with your code once it is.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { ...type.label, color: colors.textDim, lineHeight: 17 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
