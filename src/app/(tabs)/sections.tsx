// Sections: your friend groups, join by code, create one, or find a public one.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CreateSectionSheet } from '@/components/sections/CreateSectionSheet';
import { Button } from '@/components/ui/Button';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { Field, SectionHeading } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { DEMO_SECTIONS } from '@/data/demo/sections';
import { useAccountGate } from '@/hooks/useAccountGate';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

export default function SectionsScreen() {
  const router = useRouter();
  const mine = useUserStore((s) => s.sections);
  const joined = useUserStore((s) => s.joinedDemoSections);
  const join = useUserStore((s) => s.joinSection);
  const { require } = useAccountGate();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const open = (id: string) => router.push({ pathname: '/section/[id]', params: { id } });

  const rows = [
    ...mine.map((s) => ({ id: s.id, name: s.name, sportId: s.sportId, sub: `You own this · code ${s.inviteCode}`, members: 1 })),
    ...DEMO_SECTIONS.filter((s) => joined.includes(s.id)).map((s) => ({ id: s.id, name: s.name, sportId: s.sportId, sub: s.description, members: s.memberIds.length + 1 })),
  ];

  const onJoin = () => {
    if (!require('join a Section')) return;
    const r = join(code);
    if ('error' in r) { toast(r.error, 'error'); return; }
    setCode('');
    toast('Welcome to the Section!', 'success');
    open(r.id);
  };

  return (
    <Screen>
      <Header title="Sections" large right={<Button label="Leaderboard" small variant="secondary" icon="trophy" onPress={() => router.push('/leaderboard')} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Which section are you sitting in? Group chats and weekly leaderboards with your people.</Text>
        <SectionHeading title="My Sections" />
        {rows.length === 0 ? (
          <EmptyState icon="people" title="No Sections yet" body="Create one for your friends, or join with an invite code." />
        ) : rows.map((r) => <Row key={r.id} {...r} onPress={() => open(r.id)} />)}
        <View style={styles.actions}>
          <View style={styles.joinRow}>
            <View style={{ flex: 1 }}>
              <Field label="Join with an invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="e.g. 7F1A0C2E"
                autoCapitalize="characters" maxLength={8} onSubmitEditing={onJoin} />
            </View>
            <Button label="Join" onPress={onJoin} disabled={code.trim().length < 8} style={styles.joinBtn} />
          </View>
          <Button label="Create a Section" icon="add-circle" variant="secondary" onPress={() => require('create a Section') && setCreating(true)} />
        </View>
        <SectionHeading title="Public Sections" />
        {DEMO_SECTIONS.map((s) => (
          <Row key={s.id} id={s.id} name={s.name} sportId={s.sportId} sub={`${s.description} · code ${s.inviteCode}`}
            members={s.memberIds.length + (joined.includes(s.id) ? 1 : 0)} onPress={() => open(s.id)} demo />
        ))}
      </ScrollView>
      <CreateSectionSheet visible={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); open(id); }} />
    </Screen>
  );
}

function Row({ name, sportId, sub, members, onPress, demo }: { id: string; name: string; sportId: string; sub: string; members: number; onPress: () => void; demo?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${members} members`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <View style={styles.icon}><Icon name={sportIcon(sportId)} size={20} color={colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.members}>{members}</Text>
        <Text style={styles.sub}>{sportById(sportId)?.name}{demo ? ' · Public' : ''}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lead: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { ...type.label, color: colors.textDim },
  members: { fontSize: 16, fontWeight: '800', color: colors.text },
  actions: { padding: space.lg, gap: space.md },
  joinRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  joinBtn: { minWidth: 80 },
});
