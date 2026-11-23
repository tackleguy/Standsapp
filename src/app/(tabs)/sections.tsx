// Sections: your friend groups, join by code, create one, or find a public one.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CreateSectionSheet } from '@/components/sections/CreateSectionSheet';
import { Button } from '@/components/ui/Button';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { Field, SectionHeading } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { sportById } from '@/config/sports';
import { getSectionBotChat, sectionOnline } from '@/data/api';
import { DEMO_SECTIONS } from '@/data/demo/sections';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useNow } from '@/hooks/useNow';
import { timeAgo } from '@/lib/format';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

export default function SectionsScreen() {
  const router = useRouter();
  const mine = useUserStore((s) => s.sections);
  const joined = useUserStore((s) => s.joinedDemoSections);
  const join = useUserStore((s) => s.joinSection);
  const { require } = useAccountGate();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const now = useNow(30_000);
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
        {rows.length > 0 ? (
          <>
            <SectionHeading title="My Sections" />
            {rows.map((r) => <Row key={r.id} {...r} now={now} onPress={() => open(r.id)} />)}
          </>
        ) : null}
        <SectionHeading title="Popular Sections" />
        {DEMO_SECTIONS.map((s) => (
          <Row key={s.id} id={s.id} name={s.name} sportId={s.sportId} sub={s.description} now={now}
            members={s.memberIds.length + (joined.includes(s.id) ? 1 : 0)} onPress={() => open(s.id)} demo />
        ))}
        <SectionHeading title={rows.length === 0 ? 'Start your own' : 'Add a Section'} />
        {rows.length === 0 ? <Text style={styles.lead}>Create one for your friends, or join with an invite code.</Text> : null}
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
      </ScrollView>
      <CreateSectionSheet visible={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); open(id); }} />
    </Screen>
  );
}

function Row({ id, name, sportId, sub, members, now, onPress, demo }: {
  id: string; name: string; sportId: string; sub: string; members: number; now: number; onPress: () => void; demo?: boolean;
}) {
  // Public Sections have a live chat: show its latest line, like a messaging app.
  const last = demo ? getSectionBotChat(id, now)[0] : undefined;
  const online = sectionOnline(id, members, now);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${members} members, ${online} online`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <View style={styles.icon}><Icon name={sportIcon(sportId)} size={20} color={colors.accent} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {last ? <Text style={styles.when}>{timeAgo(last.at, now)}</Text> : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {last ? <Text style={styles.previewName}>{last.displayName.split(' ')[0]}: </Text> : null}{last ? last.body : sub}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.meta}>{online} online · {members} member{members === 1 ? '' : 's'} · {sportById(sportId)?.name}{demo ? ' · Public' : ''}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lead: { ...type.body, color: colors.textDim, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  when: { ...type.label, fontSize: 11, color: colors.textDim },
  preview: { fontSize: 14, color: colors.textDim },
  previewName: { fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.win },
  meta: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDim, letterSpacing: 0.3 },
  actions: { padding: space.lg, gap: space.md },
  joinRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  joinBtn: { minWidth: 80 },
});
