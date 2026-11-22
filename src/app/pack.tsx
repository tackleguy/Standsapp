// Open a pack: choose a sport (or any), see the odds, reveal three cards.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OddsTable } from '@/components/cards/OddsTable';
import { PackReveal } from '@/components/cards/PackReveal';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { sportIcon } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { SPORTS } from '@/config/sports';
import { useAccountGate } from '@/hooks/useAccountGate';
import { tapError } from '@/lib/haptics';
import { PACK_COST } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore, type OwnedCard } from '@/store/user';
import { colors, space, type } from '@/theme/tokens';

export default function PackScreen() {
  const router = useRouter();
  const tix = useUserStore((s) => s.tix);
  const openPack = useUserStore((s) => s.openPack);
  const { require } = useAccountGate();
  const [sport, setSport] = useState<string | null>(null);
  const [cards, setCards] = useState<OwnedCard[] | null>(null);

  const open = () => {
    if (!require('collect Stand Cards')) return;
    const r = openPack(sport, Date.now());
    if ('error' in r) { tapError(); toast(r.error, 'error'); return; }
    setCards(r);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Open a pack" subtitle={`${tix} Tix available`} back />
      <ScrollView contentContainerStyle={styles.body}>
        {cards ? (
          <>
            <Text style={styles.lead}>Tap each card to reveal it.</Text>
            <PackReveal key={cards[0].id} cards={cards} />
            <Button label={tix >= PACK_COST ? `Open another · ${PACK_COST} Tix` : 'Not enough Tix for another'} icon="gift"
              disabled={tix < PACK_COST} onPress={open} />
            <Button label="Done" variant="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <Text style={styles.lead}>Pick a sport for your pack, or leave it open to any sport.</Text>
            <View style={styles.chips}>
              <Chip label="Any sport" icon="apps" selected={sport === null} onPress={() => setSport(null)} />
              {SPORTS.map((s) => <Chip key={s.id} label={s.name} icon={sportIcon(s.id)} selected={sport === s.id} onPress={() => setSport(s.id)} />)}
            </View>
            <Surface><OddsTable /></Surface>
            <Button label={tix >= PACK_COST ? `Open pack · ${PACK_COST} Tix` : `You need ${PACK_COST - tix} more Tix`} icon="gift"
              disabled={tix < PACK_COST} onPress={open} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: 60 },
  lead: { ...type.body, color: colors.textDim, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
