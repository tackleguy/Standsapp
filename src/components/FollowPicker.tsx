// Pick the teams and athletes to follow, sport by sport.
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SPORTS, sportById } from '@/config/sports';
import { getWorld } from '@/data/api';
import { useUserStore } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

import { CompetitorBadge } from './Badge';
import { Chip } from './ui/Chip';
import { Icon, sportIcon } from './ui/Icon';

export function FollowPicker({ sportIds }: { sportIds: string[] }) {
  const ids = sportIds.length > 0 ? sportIds : SPORTS.map((s) => s.id);
  const [sport, setSport] = useState(ids[0]);
  const [query, setQuery] = useState('');
  const followed = useUserStore((s) => s.followedCompetitors);
  const toggle = useUserStore((s) => s.toggleCompetitor);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (getWorld().bySport.get(sport) ?? [])
      .filter((c) => q === '' || c.name.toLowerCase().includes(q))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'team' ? -1 : 1));
  }, [sport, query]);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {ids.map((id) => (
          <Chip key={id} label={sportById(id)?.name ?? id} icon={sportIcon(id)} selected={sport === id} onPress={() => setSport(id)} />
        ))}
      </ScrollView>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textDim} />
        <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${sportById(sport)?.name ?? ''}`} placeholderTextColor={colors.loss}
          style={styles.input} accessibilityLabel="Search teams and athletes" />
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const on = followed.includes(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              accessibilityLabel={`Follow ${item.name}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
              <CompetitorBadge id={item.id} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.kind === 'team' ? item.home : `${item.home}`}</Text>
              </View>
              <View style={[styles.follow, on && styles.followOn]}>
                <Text style={[styles.followText, on && { color: colors.accentInk }]}>{on ? 'Following' : 'Follow'}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginBottom: space.sm,
    paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  input: { flex: 1, minHeight: 44, color: colors.text, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 56 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { ...type.label, color: colors.textDim },
  follow: { minWidth: 96, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  followOn: { backgroundColor: colors.accent },
  followText: { ...type.label, color: colors.accent },
});
