// Search teams, athletes, competitions, and sports. Before you type: what is
// trending right now and quick links to every table.
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { SPORTS, sportById } from '@/config/sports';
import { competitorById, crowdLabel, leagueName, watchersFor } from '@/data/api';
import { useDayEvents, useSearch } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { startOfLocalDay } from '@/lib/format';
import { useSettingsStore } from '@/store/settings';
import { useUserStore } from '@/store/user';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

export default function SearchScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const results = useSearch(q);
  const setSport = useSettingsStore((s) => s.setSelectedSport);
  const r = results.data;
  const empty = q.trim().length >= 2 && r && r.sports.length + r.competitors.length + r.competitions.length === 0;
  const now = useNow(60_000);
  const today = useDayEvents(startOfLocalDay(now));
  const followedSports = useUserStore((s) => s.followedSports);
  const tableSports = [...followedSports, ...SPORTS.map((x) => x.id).filter((id) => !followedSports.includes(id))].slice(0, 8);

  // Teams in the most-watched live games right now.
  const trending = useMemo(() => {
    const t = Math.max(now, today.dataUpdatedAt);
    const live = (today.data ?? []).filter((e) => e.status === 'live' && e.meta.format !== 'race')
      .map((e) => ({ e, w: watchersFor(e, t) })).sort((a, b) => b.w - a.w);
    const out: { id: string; line: string; watchers: number; eventId: string }[] = [];
    for (const { e, w } of live) {
      const [home, away] = e.entries;
      const score = e.meta.format === 'innings' ? (home.scoreText ?? '') : `${home.score ?? 0}-${away.score ?? 0}`;
      const line = `Live · ${competitorById(home.competitorId)?.shortName} ${score} ${competitorById(away.competitorId)?.shortName} · ${e.periodLabel ?? ''}`;
      for (const side of [home, away]) {
        if (out.length < 8 && !out.some((x) => x.id === side.competitorId)) out.push({ id: side.competitorId, line, watchers: w, eventId: e.meta.id });
      }
    }
    return out;
  }, [today.data, today.dataUpdatedAt, now]);

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
        {q.trim().length < 2 ? (
          <>
            {trending.length > 0 ? <SectionHeading title="Trending now" /> : null}
            {trending.map((t) => {
              const c = competitorById(t.id);
              return (
                <Row key={t.id} title={c?.name ?? '?'} sub={t.line} icon={<CompetitorBadge id={t.id} size={32} />}
                  trailing={<Text style={styles.trend}>{crowdLabel(t.watchers)}</Text>}
                  onPress={() => router.push({ pathname: '/competitor/[id]', params: { id: t.id } })} />
              );
            })}
            <SectionHeading title="Standings" />
            <View style={styles.tables}>
              {tableSports.map((id) => (
                <Pressable key={id} onPress={() => router.push({ pathname: '/standings/[sportId]', params: { sportId: id } })}
                  accessibilityRole="button" accessibilityLabel={`${leagueName(id)} standings`}
                  style={({ pressed }) => [styles.tableChip, pressed && { backgroundColor: colors.surfaceHigh }]}>
                  <Icon name={sportIcon(id)} size={16} color={colors.accent} />
                  <Text style={styles.tableText} numberOfLines={1}>{leagueName(id)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
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
          <Row key={c.id} title={c.name} sub={`${sportById(c.sportId)?.name ?? ''} · Standings`} icon={<Icon name="trophy" size={22} color={colors.accent} />}
            onPress={() => router.push({ pathname: '/standings/[sportId]', params: { sportId: c.sportId } })} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Row({ title, sub, icon, trailing, onPress }: { title: string; sub: string; icon: React.ReactNode; trailing?: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      {trailing}
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
  trend: { fontFamily: fonts.bold, fontSize: 14, color: colors.textDim, fontVariant: ['tabular-nums'] },
  tables: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg },
  tableChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, maxWidth: '100%' },
  tableText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, letterSpacing: 0.4 },
});
