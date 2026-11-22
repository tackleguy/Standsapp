import { StyleSheet, Text, View } from 'react-native';

import { oddsText } from '@/logic/packs';
import { PACK_COST, PACK_ODDS, PACK_SIZE } from '@/logic/rules';
import { colors, space, type } from '@/theme/tokens';

/** Published pack odds, shown on the pack screen as the app stores require. */
export function OddsTable() {
  return (
    <View style={styles.wrap} accessibilityLabel="Pack odds">
      <Text style={styles.lead}>Each pack has {PACK_SIZE} cards and costs {PACK_COST} Tix. Every card is rolled separately with these odds:</Text>
      {PACK_ODDS.map((o) => (
        <View key={o.rarity} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: colors.rarity[o.rarity] }]} />
          <Text style={styles.name}>{o.rarity[0].toUpperCase() + o.rarity.slice(1)}</Text>
          <Text style={styles.pct}>{oddsText(o.chance)}</Text>
        </View>
      ))}
      <Text style={styles.note}>Tix are earned by playing (daily Gate Check and winning cards). They can never be bought or cashed out, and cards have no cash value.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  lead: { ...type.body, color: colors.textDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, borderBottomWidth: 1, borderColor: colors.line },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  pct: { fontSize: 16, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  note: { ...type.label, color: colors.textDim, lineHeight: 17, marginTop: space.sm },
});
