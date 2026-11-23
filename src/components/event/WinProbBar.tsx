// A three-way win probability bar in the teams' colours: home · draw · away.
import { StyleSheet, Text, View } from 'react-native';

import { competitorById } from '@/data/api';
import { asPercents, type WinProb } from '@/logic/winProbability';
import { colors, fonts, space, type } from '@/theme/tokens';

interface Props {
  prob: WinProb;
  homeId: string;
  awayId: string;
  homeColor: string;
  awayColor: string;
  draws: boolean;
  label?: string;
  large?: boolean;
}

export function WinProbBar({ prob, homeId, awayId, homeColor, awayColor, draws, label = 'Win probability', large = false }: Props) {
  const pct = asPercents(prob, draws);
  const home = competitorById(homeId)?.shortName ?? 'HOME';
  const away = competitorById(awayId)?.shortName ?? 'AWAY';
  return (
    <View style={styles.wrap} accessibilityLabel={`${label}: ${home} ${pct.home}%,${draws ? ` draw ${pct.draw}%,` : ''} ${away} ${pct.away}%`}>
      <View style={styles.labels}>
        <Text style={[styles.pct, large && styles.pctLarge, { color: homeColor }]}>{pct.home}%</Text>
        <Text style={styles.title} numberOfLines={1}>{[label, draws ? `Draw ${pct.draw}%` : ''].filter(Boolean).join(' · ')}</Text>
        <Text style={[styles.pct, large && styles.pctLarge, { color: awayColor }]}>{pct.away}%</Text>
      </View>
      <View style={[styles.bar, large && styles.barLarge]}>
        <View style={{ flex: Math.max(0.5, pct.home), backgroundColor: homeColor }} />
        {draws && pct.draw > 0 ? <View style={{ flex: pct.draw, backgroundColor: colors.loss }} /> : null}
        <View style={{ flex: Math.max(0.5, pct.away), backgroundColor: awayColor }} />
      </View>
      {large ? (
        <View style={styles.names}>
          <Text style={styles.name}>{home}</Text>
          <Text style={styles.name}>{away}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  labels: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  pct: { fontFamily: fonts.heavy, fontSize: 18, fontVariant: ['tabular-nums'] },
  pctLarge: { fontSize: 30 },
  title: { ...type.caps, fontSize: 11, color: colors.textDim, flex: 1, textAlign: 'center' },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  barLarge: { height: 10, borderRadius: 5 },
  names: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { ...type.caps, fontSize: 12, color: colors.textDim },
});
