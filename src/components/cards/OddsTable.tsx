import { StyleSheet, Text, View } from 'react-native';

import { RARITY_ORDER, rarityLabel } from '@/logic/cards';
import { oddsText } from '@/logic/packs';
import { HOLO_CHANCE, PACK_TYPES, TIX_DISCLAIMER, type PackType } from '@/logic/rules';
import { colors, space, type } from '@/theme/tokens';

const chanceOf = (odds: PackType['odds'], rarity: string) => odds.find((o) => o.rarity === rarity)?.chance ?? 0;

/** Published odds for one pack type, shown before every purchase as the app stores require. */
export function OddsTable({ pack = PACK_TYPES.standard }: { pack?: PackType }) {
  const g = pack.guaranteed;
  const firstLabel = !g ? 'Every card' : pack.size === 2 ? 'Card 1' : `Cards 1–${pack.size - 1}`;
  return (
    <View style={styles.wrap} accessibilityLabel={`${pack.name} odds`}>
      <Text style={styles.lead}>
        {pack.name}: {pack.size} card{pack.size === 1 ? '' : 's'} for {pack.cost === 0 ? 'free' : `${pack.cost} Tix`}.
        {' '}Every card is rolled separately with these odds{g ? `, and the last card is always ${g.label}` : ''}:
      </Text>
      <View style={[styles.row, styles.headRow]}>
        <Text style={[styles.name, styles.head]}>Rarity</Text>
        <Text style={[styles.pct, styles.head]}>{firstLabel}</Text>
        {g ? <Text style={[styles.pct, styles.head]}>Card {pack.size}</Text> : null}
      </View>
      {RARITY_ORDER.map((r) => (
        <View key={r} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: colors.rarity[r] }]} />
          <Text style={styles.name}>{rarityLabel(r)}</Text>
          <Text style={styles.pct}>{oddsText(chanceOf(pack.odds, r))}</Text>
          {g ? <Text style={styles.pct}>{oddsText(chanceOf(g.odds, r))}</Text> : null}
        </View>
      ))}
      <View style={styles.row}>
        <View style={[styles.swatch, styles.holo]} />
        <Text style={styles.name}>Holo parallel (any card)</Text>
        <Text style={styles.pct}>{oddsText(HOLO_CHANCE)}</Text>
        {g ? <Text style={styles.pct}>{oddsText(HOLO_CHANCE)}</Text> : null}
      </View>
      <Text style={styles.note}>{TIX_DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  lead: { ...type.body, color: colors.textDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, borderBottomWidth: 1, borderColor: colors.line },
  headRow: { minHeight: 28 },
  head: { ...type.label, color: colors.textDim, fontSize: 11 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  holo: { backgroundColor: '#FF7AD9', borderWidth: 2, borderColor: '#7AE7FF' },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  pct: { minWidth: 72, textAlign: 'right', fontSize: 16, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  note: { ...type.label, color: colors.textDim, lineHeight: 17, marginTop: space.sm },
});
