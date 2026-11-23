// Standings for a sport: league table (or form), win-loss standings, a
// championship with drivers and teams, or fighter rankings.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ChampionshipTable, FightRankings, TeamTable, TeamsChampionshipTable, type TableView,
} from '@/components/standings/StandingsTable';
import { Chip } from '@/components/ui/Chip';
import { sportIcon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';
import { SPORTS, sportById } from '@/config/sports';
import {
  championship, competitorById, fightRankings, leagueName, nextRoundAt, roundsPlayed, standingsKind, teamsChampionship, teamTable,
} from '@/data/api';
import { useNow } from '@/hooks/useNow';
import { timeUntil } from '@/lib/format';
import { useUserStore } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

type ChampView = 'drivers' | 'teams';
type StandingsData =
  | { kind: 'teams'; table: 'table' | 'pct'; rows: ReturnType<typeof teamTable> }
  | { kind: 'championship'; rows: ReturnType<typeof championship>; teams: ReturnType<typeof teamsChampionship> }
  | { kind: 'record'; rows: ReturnType<typeof fightRankings> };

export default function StandingsScreen() {
  const { sportId: param } = useLocalSearchParams<{ sportId: string }>();
  const router = useRouter();
  const now = useNow(60_000);
  const [sportId, setSportId] = useState(sportById(String(param)) ? String(param) : 'soccer');
  const [view, setView] = useState<TableView>('table');
  const [champView, setChampView] = useState<ChampView>('drivers');
  const followedSports = useUserStore((s) => s.followedSports);
  const followed = useUserStore((s) => s.followedCompetitors);
  const highlight = useMemo(() => new Set(followed), [followed]);
  const kind = standingsKind(sportId);
  const round = roundsPlayed(sportId, now);
  const order = [...followedSports, ...SPORTS.map((s) => s.id).filter((id) => !followedSports.includes(id))];
  const open = (id: string) => router.push({ pathname: '/competitor/[id]', params: { id } });

  // Tables are cached per round inside the season model, so this stays cheap.
  const data = useMemo((): StandingsData => {
    if (kind === 'table' || kind === 'pct') return { kind: 'teams', table: kind, rows: teamTable(sportId, now) };
    if (kind === 'championship') return { kind: 'championship', rows: championship(sportId, now), teams: teamsChampionship(sportId, now) };
    return { kind: 'record', rows: fightRankings(sportId) };
  }, [sportId, now, kind]);

  const hasTeams = data.kind === 'championship' && data.teams.length > 0;
  const roundWord = kind === 'championship' ? (sportId === 'tennis' || sportId === 'golf' || sportId === 'cycling' ? 'event' : 'round') : 'round';
  const subtitle = kind === 'record'
    ? `${sportById(sportId)?.name} · Rankings`
    : `After ${round} ${roundWord}${round === 1 ? '' : 's'} · next update ${timeUntil(nextRoundAt(sportId, now), now)}`;

  return (
    <Screen>
      <Header title={leagueName(sportId)} subtitle={subtitle} back />
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} stickyHeaderIndices={[1]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {order.map((id) => (
            <Chip key={id} label={sportById(id)?.name ?? id} icon={sportIcon(id)} selected={sportId === id}
              onPress={() => { setSportId(id); setView('table'); setChampView('drivers'); }} />
          ))}
        </ScrollView>
        <View style={styles.segWrap}>
          {data.kind === 'teams' ? (
            <Segmented value={view} onChange={setView} options={[{ value: 'table', label: 'Table' }, { value: 'form', label: 'Form' }]} />
          ) : hasTeams ? (
            <Segmented value={champView} onChange={setChampView} options={[
              { value: 'drivers', label: sportId === 'cycling' ? 'Riders' : 'Drivers' }, { value: 'teams', label: 'Teams' },
            ]} />
          ) : (
            <Text style={styles.kicker}>{data.kind === 'record' ? 'Division rankings' : 'Season standings'}</Text>
          )}
        </View>
        <View style={styles.card}>
          {data.kind === 'teams' ? (
            data.rows.length === 0 ? <EmptyState icon="list" title="The season has not started" />
              : <TeamTable sportId={sportId} kind={data.table} rows={data.rows} view={view} highlight={highlight} onPress={open} />
          ) : data.kind === 'championship' ? (
            champView === 'teams' && hasTeams
              ? <TeamsChampionshipTable rows={data.teams} highlight={highlight} onPress={open} />
              : <ChampionshipTable rows={data.rows} highlight={highlight} onPress={open} />
          ) : (
            <FightRankings rows={data.rows} highlight={highlight} onPress={open} />
          )}
        </View>
        {followed.length === 0 ? (
          <Text style={styles.tip}>Follow teams and athletes to highlight them here.</Text>
        ) : followed.some((id) => competitorById(id)?.sportId === sportId) ? (
          <Text style={styles.tip}>Teams and athletes you follow are highlighted.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  segWrap: { paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.bg },
  kicker: { ...type.caps, color: colors.textDim, paddingVertical: space.sm },
  card: { marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  tip: { ...type.label, color: colors.textDim, textAlign: 'center', padding: space.lg },
});
