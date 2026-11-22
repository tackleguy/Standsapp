// Search teams, athletes, competitions, and sports.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { sportById } from '@/config/sports';
import { competitorById } from '@/data/api';
import { useSearch } from '@/hooks/useLiveData';
import { useSettingsStore } from '@/store/settings';
import { colors, radius, space, type } from '@/theme/tokens';

export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const results = useSearch(q);
  const setSport = useSettingsStore((s) => s.setSelectedSport);
  const r = results.data;
  const empty = q.trim().length >= 2 && r && r.sports.length + r.competitors.length + r.competitions.length === 0;

  return (
    <Screen>
      <Header title="Search" back />
      <View style={styles.box}>
        <Icon name="search" size={18} color={colors.textDim} />
        <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Teams, athletes, competitions" placeholderTextColor={colors.loss}
          style={styles.input} accessibilityLabel="Search" returnKeyType="search" />
        {q ? <Pressable onPress={() => setQ('')} accessibilityLabel="Clear search" hitSlop={10}><Icon name="close-circle" size={18} color={colors.textDim} /></Pressable> : null}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
        {q.trim().length < 2 ? <EmptyState icon="search" title="Find anything" body="Search 18 sports, hundreds of teams and athletes." /> : null}
        {empty ? <EmptyState icon="sad-outline" title="No matches" body={`Nothing found for “${q.trim()}”.`} /> : null}
        {r && r.sports.length > 0 ? <SectionHeading title="Sports" /> : null}
        {r?.sports.map((s) => (
          <Row key={s.id} title={s.name} sub="Show on Today" icon={<Icon name={sportIcon(s.id)} size={22} color={colors.accent} />}
            onPress={() => { setSport(s.id); router.replace('/'); }} />
        ))}
        {r && r.competitors.length > 0 ? <SectionHeading title="Teams & athletes" /> : null}
        {r?.competitors.map((c) => (
          <Row key={c.id} title={c.name} sub={`${sportById(c.sportId)?.name} · ${c.kind === 'athlete' ? competitorById(c.parentId)?.name ?? c.home : c.home}`}
            icon={<CompetitorBadge id={c.id} size={32} />} onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: c.id } })} />
        ))}
        {r && r.competitions.length > 0 ? <SectionHeading title="Competitions" /> : null}
        {r?.competitions.map((c) => (
          <Row key={c.id} title={c.name} sub={sportById(c.sportId)?.name ?? ''} icon={<Icon name="trophy" size={22} color={colors.accent} />}
            onPress={() => { setSport(c.sportId); router.replace('/'); }} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Row({ title, sub, icon, onPress }: { title: string; sub: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, paddingHorizontal: space.md,
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  input: { flex: 1, minHeight: 48, color: colors.text, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56 },
  icon: { width: 36, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { ...type.label, color: colors.textDim },
});
