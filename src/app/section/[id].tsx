// A Section: group chat, weekly leaderboard, and members.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ChatView } from '@/components/chat/ChatView';
import { Leaderboard } from '@/components/Leaderboard';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { demoSectionById } from '@/data/demo/sections';
import { useAccountGate } from '@/hooks/useAccountGate';
import { toast } from '@/store/toast';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

export default function SectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const mine = useUserStore((s) => s.sections.find((x) => x.id === id));
  const joined = useUserStore((s) => s.joinedDemoSections.includes(String(id)));
  const join = useUserStore((s) => s.joinSection);
  const leave = useUserStore((s) => s.leaveSection);
  const remove = useUserStore((s) => s.deleteSection);
  const { require } = useAccountGate();
  const [tab, setTab] = useState<'chat' | 'board' | 'about'>('chat');
  const demo = demoSectionById(String(id));
  const section = mine ?? demo;

  if (!section) return <Screen><Header title="Section" back /><EmptyState icon="people" title="Section not found" /></Screen>;
  const isMember = !!mine || joined;
  const memberIds = demo ? demo.memberIds : [];
  const share = async () => {
    try { await Share.share({ message: `Join my Section "${section.name}" on Stands. Invite code: ${section.inviteCode}` }); }
    catch { toast(`Invite code: ${section.inviteCode}`); }
  };

  return (
    <Screen>
      <Header title={section.name} subtitle={`${sportById(section.sportId)?.name} · code ${section.inviteCode}`} back
        right={<IconButton icon="share-social-outline" label="Share invite code" onPress={share} />} />
      <View style={styles.tabs}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'chat', label: 'Chat' }, { value: 'board', label: 'This week' }, { value: 'about', label: 'About' }]} />
      </View>
      {tab === 'chat' && (isMember ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <ChatView threadId={`section:${section.id}`} onNeedAccount={() => require('chat in Sections')} placeholder={`Message ${section.name}…`} />
        </KeyboardAvoidingView>
      ) : (
        <EmptyState icon="lock-closed" title="Join to see the chat" body="Members can chat and compete on the weekly leaderboard."
          actionLabel="Join this Section" onAction={() => {
            if (!require('join a Section')) return;
            const r = join(section.inviteCode);
            if ('error' in r) toast(r.error, 'error'); else toast('Welcome to the Section!', 'success');
          }} />
      ))}
      {tab === 'board' && <Leaderboard fanIds={memberIds} includeMe={isMember} />}
      {tab === 'about' && (
        <ScrollView contentContainerStyle={styles.about}>
          {demo ? <Text style={styles.body}>{demo.description}</Text> : <Text style={styles.body}>Your private Section.</Text>}
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Invite code</Text>
            <Text style={styles.code} selectable>{section.inviteCode}</Text>
            <Button label="Share invite" icon="share-social" small onPress={share} />
          </View>
          <Text style={styles.body}>{memberIds.length + (isMember ? 1 : 0)} members.</Text>
          {!demo ? <Text style={styles.note}>Until Stands is connected to its database, this Section lives on this device only.</Text> : null}
          {mine ? (
            <Button label="Delete Section" icon="trash" variant="danger" onPress={() => { remove(section.id); toast('Section deleted.'); router.back(); }} />
          ) : joined ? (
            <Button label="Leave Section" icon="exit" variant="secondary" onPress={() => { leave(section.id); toast('You left the Section.'); }} />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  about: { padding: space.lg, gap: space.lg },
  body: { ...type.body, color: colors.text },
  note: { ...type.label, color: colors.textDim },
  codeBox: { alignItems: 'center', gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  codeLabel: { ...type.label, color: colors.textDim },
  code: { fontSize: 32, fontWeight: '900', color: colors.accent, letterSpacing: 4 },
});
