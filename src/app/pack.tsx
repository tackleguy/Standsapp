// The Pack Store: pick a pack type (or a Game Pack for a live game), see its odds,
// open it, reveal the cards, and quick sell any duplicates on the spot.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CompetitorBadge } from '@/components/Badge';
import { OddsTable } from '@/components/cards/OddsTable';
import { PACK_TONE, PackArt } from '@/components/cards/PackArt';
import { PackOpening } from '@/components/cards/PackOpening';
import { PackReveal } from '@/components/cards/PackReveal';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon, sportIcon } from '@/components/ui/Icon';
import { LiveDot } from '@/components/ui/LiveDot';
import { Surface } from '@/components/ui/Misc';
import { Header, Screen } from '@/components/ui/Screen';
import { SPORTS, sportById } from '@/config/sports';
import type { EventState, PackTypeId } from '@/data/types';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useEvent, useGamePacks } from '@/hooks/useLiveData';
import { useNow } from '@/hooks/useNow';
import { currentTime, DAY, timeUntil, utcDayKey } from '@/lib/format';
import { tapError, tapMedium } from '@/lib/haptics';
import { totalSellValue } from '@/logic/cards';
import { gamePackOpen } from '@/logic/packs';
import { GAME_DAY_WIN_MULTIPLIER, GAME_PACK_OPENS_MS, PACK_TYPES, SHELF_PACKS } from '@/logic/rules';
import { toast } from '@/store/toast';
import { useUserStore, type PackResult } from '@/store/user';
import { colors, radius, space, type } from '@/theme/tokens';

const isPackId = (v: unknown): v is PackTypeId => typeof v === 'string' && v in PACK_TYPES;

export default function PackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; event?: string; sport?: string }>();
  const tix = useUserStore((s) => s.tix);
  const lastFreePack = useUserStore((s) => s.lastFreePack);
  const followed = useUserStore((s) => s.followedCompetitors);
  const openPack = useUserStore((s) => s.openPack);
  const quickSell = useUserStore((s) => s.quickSell);
  const { require } = useAccountGate();
  const now = useNow(15_000);

  const [packId, setPackId] = useState<PackTypeId | null>(params.event ? 'game' : isPackId(params.type) ? params.type : null);
  const [eventId, setEventId] = useState<string | null>(params.event ?? null);
  const [sport, setSport] = useState<string | null>(params.sport && sportById(params.sport) ? params.sport : null);
  const [phase, setPhase] = useState<'pick' | 'opening' | 'reveal'>('pick');
  const [result, setResult] = useState<PackResult | null>(null);
  const [sold, setSold] = useState<Set<string>>(() => new Set());
  const [revealedAll, setRevealedAll] = useState(false);
  const [allGames, setAllGames] = useState(false);

  const game = useEvent(eventId ?? '');
  const games = useGamePacks();
  const freeReady = lastFreePack !== utcDayKey(now);
  const nextFree = Math.floor(now / DAY) * DAY + DAY;
  const pack = packId ? PACK_TYPES[packId] : null;
  const gameState = packId === 'game' ? game.data ?? null : null;

  const finishOpening = useCallback(() => setPhase('reveal'), []);
  const markRevealed = useCallback(() => setRevealedAll(true), []);

  const choose = (id: PackTypeId, event: string | null = null) => {
    setPackId(id);
    setEventId(event);
    setPhase('pick');
    setResult(null);
  };

  const open = () => {
    if (!packId) return;
    if (!require('collect Stand Cards')) return;
    const r = openPack({ packId, sportId: sport, eventId }, currentTime());
    if ('error' in r) { tapError(); toast(r.error, 'error'); return; }
    tapMedium();
    setResult(r);
    setSold(new Set());
    setRevealedAll(false);
    setPhase('opening');
  };

  const dupes = result ? result.cards.filter((c, i) => !result.isNew[i] && !sold.has(c.id)) : [];
  const sellDupes = () => {
    const r = quickSell(dupes.map((c) => c.id), currentTime());
    if ('error' in r) { toast(r.error, 'error'); return; }
    tapMedium();
    toast(`Quick sold ${r.sold} duplicate${r.sold === 1 ? '' : 's'} · +${r.tix} Tix`, 'success');
    setSold(new Set([...sold, ...dupes.map((c) => c.id)]));
  };

  let openLabel = '';
  let canOpen = false;
  if (pack) {
    const gameOpen = packId !== 'game' || (!!gameState && gamePackOpen(gameState, now));
    if (packId === 'daily' && !freeReady) openLabel = `Next free pack ${timeUntil(nextFree, now)}`;
    else if (!gameOpen) openLabel = game.isLoading ? 'Loading the game…' : 'This Game Pack is closed';
    else if (tix < pack.cost) openLabel = `You need ${pack.cost - tix} more Tix`;
    else { openLabel = pack.cost === 0 ? 'Open free pack' : `Open · ${pack.cost} Tix`; canOpen = true; }
  }

  const followedSet = new Set(followed);
  const gameList = [...(games.data ?? [])].sort((a, b) =>
    Number(b.meta.competitorIds.some((id) => followedSet.has(id))) - Number(a.meta.competitorIds.some((id) => followedSet.has(id))));
  const shownGames = allGames ? gameList : gameList.slice(0, 6);

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Pack Store" subtitle={`${tix} Tix available`} back />
      <ScrollView contentContainerStyle={styles.body}>
        {phase === 'opening' && packId ? <PackOpening packId={packId} onDone={finishOpening} /> : null}

        {phase === 'reveal' && result && pack ? (
          <>
            <Text style={styles.lead}>
              {revealedAll ? summary(result) : 'Tap each card to reveal it.'}
            </Text>
            <PackReveal key={result.cards[0].id} cards={result.cards} isNew={result.isNew} sold={sold} onAllRevealed={markRevealed} />
            {revealedAll && dupes.length > 0 ? (
              <Button label={`Quick sell duplicates · +${totalSellValue(dupes)} Tix`} icon="pricetag" variant="secondary" onPress={sellDupes} />
            ) : null}
            <Button label={canOpen ? `Open another · ${pack.cost === 0 ? 'free' : `${pack.cost} Tix`}` : openLabel} icon="gift"
              disabled={!canOpen} onPress={open} />
            <Button label="Back to the store" variant="ghost" onPress={() => { setPackId(null); setResult(null); setPhase('pick'); }} />
            <Button label="Done" variant="secondary" onPress={() => router.back()} />
          </>
        ) : null}

        {phase === 'pick' && pack && packId ? (
          <>
            <View style={styles.hero}>
              <PackArt packId={packId} width={110} />
              <Text style={styles.title}>{pack.name}</Text>
              <Text style={styles.lead}>{pack.blurb}</Text>
            </View>
            {packId === 'game' ? <GameInfo state={gameState} loading={game.isLoading} /> : null}
            {pack.sportChoice ? (
              <>
                <Text style={styles.label}>Pick a sport, or leave it open to any sport</Text>
                <View style={styles.chips}>
                  <Chip label="Any sport" icon="apps" selected={sport === null} onPress={() => setSport(null)} />
                  {SPORTS.map((s) => <Chip key={s.id} label={s.name} icon={sportIcon(s.id)} selected={sport === s.id} onPress={() => setSport(s.id)} />)}
                </View>
              </>
            ) : null}
            <Surface><OddsTable pack={pack} /></Surface>
            <Button label={openLabel} icon="gift" disabled={!canOpen} onPress={open} />
            <Button label="See all packs" variant="ghost" onPress={() => setPackId(null)} />
          </>
        ) : null}

        {phase === 'pick' && !pack ? (
          <>
            <Text style={styles.lead}>Every pack shows its odds before you open it. Tix are earned by playing and can never be bought.</Text>
            {SHELF_PACKS.map((id) => {
              const p = PACK_TYPES[id];
              const status = id === 'daily' ? (freeReady ? 'Ready to open' : `Next one ${timeUntil(nextFree, now)}`) : null;
              return (
                <Pressable key={id} onPress={() => choose(id)} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.cost === 0 ? 'free' : `${p.cost} Tix`}`}
                  style={({ pressed }) => [styles.packRow, { borderColor: id === 'daily' && freeReady ? PACK_TONE.daily : colors.line }, pressed && styles.pressed]}>
                  <PackArt packId={id} width={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.packName}>{p.name}</Text>
                    <Text style={[styles.packMeta, { color: PACK_TONE[id] }]}>
                      {p.size} card{p.size === 1 ? '' : 's'} · {p.cost === 0 ? 'Free' : `${p.cost} Tix`}{status ? ` · ${status}` : ''}
                    </Text>
                    <Text style={styles.packBlurb}>{p.blurb}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textDim} />
                </Pressable>
              );
            })}

            <Text style={styles.heading}>Game Packs</Text>
            <Text style={styles.packBlurb}>
              {PACK_TYPES.game.size} Game Day cards from the teams or athletes in one game, {PACK_TYPES.game.cost} Tix.
              On sale from {GAME_PACK_OPENS_MS / 3_600_000} hours before the start until the game ends. Game Day cards pay
              {' '}{GAME_DAY_WIN_MULTIPLIER}× Tix if their side wins that game.
            </Text>
            {games.isLoading ? <Text style={styles.packBlurb}>Finding games…</Text> : null}
            {!games.isLoading && gameList.length === 0 ? (
              <Text style={styles.packBlurb}>No Game Packs on sale right now. Check back when a game is about to start.</Text>
            ) : null}
            {shownGames.map((s) => <GameRow key={s.meta.id} state={s} now={now} followed={s.meta.competitorIds.some((id) => followedSet.has(id))}
              onPress={() => choose('game', s.meta.id)} />)}
            {gameList.length > shownGames.length ? (
              <Button label={`Show all ${gameList.length} games`} variant="ghost" small onPress={() => setAllGames(true)} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function summary(r: PackResult): string {
  const fresh = r.isNew.filter(Boolean).length;
  const dupes = r.isNew.length - fresh;
  const parts = [`${fresh} new`, dupes ? `${dupes} duplicate${dupes === 1 ? '' : 's'}` : null];
  const holo = r.cards.filter((c) => c.finish === 'holo').length;
  if (holo) parts.push(`${holo} Holo!`);
  return parts.filter(Boolean).join(' · ');
}

function GameRow({ state, now, followed, onPress }: { state: EventState; now: number; followed: boolean; onPress: () => void }) {
  const live = state.status === 'live';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Game Pack: ${state.meta.title}`}
      style={({ pressed }) => [styles.gameRow, pressed && styles.pressed]}>
      <Icon name={sportIcon(state.meta.sportId)} size={20} color={colors.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={styles.gameTitle} numberOfLines={1}>{followed ? '★ ' : ''}{state.meta.title}</Text>
        <View style={styles.gameStatus}>
          {live ? <LiveDot /> : null}
          <Text style={[styles.packMeta, { color: live ? colors.live : colors.textDim }]} numberOfLines={1}>
            {live ? `Live${state.periodLabel ? ` · ${state.periodLabel}` : ''}` : `Starts ${timeUntil(state.meta.startsAt, now)}`}
            {' · '}{sportById(state.meta.sportId)?.name}
          </Text>
        </View>
      </View>
      <Text style={styles.price}>{PACK_TYPES.game.cost} Tix</Text>
      <Icon name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
}

function GameInfo({ state, loading }: { state: EventState | null; loading: boolean }) {
  if (loading) return <Text style={styles.lead}>Loading the game…</Text>;
  if (!state) return <Text style={styles.lead}>That game could not be found.</Text>;
  const ids = state.meta.competitorIds;
  return (
    <Surface style={{ gap: space.sm }}>
      <Text style={styles.packName}>{state.meta.title}</Text>
      <Text style={styles.packBlurb}>
        {sportById(state.meta.sportId)?.name} · {state.status === 'live' ? 'Live now' : state.status === 'scheduled' ? 'Starting soon' : 'Finished'}
        {' · '}cards of {ids.length === 2 ? 'both sides' : `all ${ids.length} in the field`}
      </Text>
      {ids.length <= 8 ? (
        <View style={styles.badges}>{ids.map((id) => <CompetitorBadge key={id} id={id} size={36} />)}</View>
      ) : null}
      <GamePackNote />
    </Surface>
  );
}

function GamePackNote() {
  return (
    <Text style={styles.packBlurb}>
      Game Day cards carry this game’s stamp and their own print run. If their side wins this game they pay {GAME_DAY_WIN_MULTIPLIER}× Tix and get a WON stamp.
    </Text>
  );
}


const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: 60 },
  hero: { alignItems: 'center', gap: space.sm },
  title: { ...type.title, color: colors.text, textAlign: 'center' },
  lead: { ...type.body, color: colors.textDim, textAlign: 'center' },
  label: { ...type.label, color: colors.textDim, textTransform: 'uppercase' },
  heading: { ...type.label, color: colors.textDim, textTransform: 'uppercase', marginTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1 },
  pressed: { opacity: 0.85 },
  packName: { fontSize: 17, fontWeight: '800', color: colors.text },
  packMeta: { ...type.label, fontSize: 13 },
  packBlurb: { ...type.label, color: colors.textDim, lineHeight: 17, fontWeight: '500' },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, minHeight: 60 },
  gameTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  gameStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  price: { ...type.label, color: colors.text, fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
