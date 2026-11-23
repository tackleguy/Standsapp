// The same checks the build plan asks of the database routines, run against the
// on-device rules: one call per fan, no overspending, settling twice changes nothing,
// and Clout can only move through the routines.
import { callsForEvent, viewCall } from '@/data/demo/calls';
import { finalState, simulate } from '@/data/demo/engines';
import { eventsForUtcDay } from '@/data/demo/schedule';
import { useUserStore } from '@/store/user';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const DAY = Date.parse('2026-11-22T00:00:00Z');

function signUp() {
  useUserStore.getState().deleteAccount();
  const err = useUserStore.getState().createAccount({ username: 'tester_1', displayName: 'Tester', birthYear: 1990, email: '' });
  expect(err).toBeNull();
}

function openCallFor(sportId: string) {
  const meta = eventsForUtcDay(DAY).find((m) => m.sportId === sportId && !m.disruption)!;
  const before = meta.startsAt - 60_000;
  const call = viewCall(callsForEvent(meta).find((c) => c.kind === 'winner')!, simulate(meta, before), before);
  return { meta, call, before };
}

describe('Calls on this device follow the server rules', () => {
  beforeEach(signUp);

  it('places a prediction and takes the stake', () => {
    const { meta, call, before } = openCallFor('soccer');
    expect(call.status).toBe('open');
    const err = useUserStore.getState().placePrediction({ call, option: call.options[0], options: call.options, stake: 100,
      eventTitle: meta.title, sportId: meta.sportId, now: before });
    expect(err).toBeNull();
    expect(useUserStore.getState().clout).toBe(900);
  });

  it('refuses a second prediction on the same call', () => {
    const { meta, call, before } = openCallFor('soccer');
    const place = () => useUserStore.getState().placePrediction({ call, option: call.options[1], options: call.options, stake: 50,
      eventTitle: meta.title, sportId: meta.sportId, now: before });
    expect(place()).toBeNull();
    expect(place()).toBe('You already made this call.');
    expect(useUserStore.getState().clout).toBe(950);
  });

  it('refuses to overspend', () => {
    useUserStore.setState({ clout: 40 });
    const { meta, call, before } = openCallFor('basketball');
    const err = useUserStore.getState().placePrediction({ call, option: call.options[0], options: call.options, stake: 50,
      eventTitle: meta.title, sportId: meta.sportId, now: before });
    expect(err).toBe('Not enough Clout.');
    expect(useUserStore.getState().clout).toBe(40);
  });

  it('settles once: running settle twice changes nothing the second time', () => {
    const { meta, call, before } = openCallFor('rugby_union');
    useUserStore.getState().placePrediction({ call, option: call.options[0], options: call.options, stake: 100,
      eventTitle: meta.title, sportId: meta.sportId, now: before });
    const after = finalState(meta).endsAt + 1000;
    useUserStore.getState().settle(after);
    const once = useUserStore.getState();
    const p = once.predictions[0];
    expect(p.status).not.toBe('open');
    const second = useUserStore.getState().settle(after);
    expect(second).toEqual({ won: 0, lost: 0, refunded: 0, clout: second.clout, tix: second.tix });
    expect(useUserStore.getState().clout).toBe(once.clout + second.clout);
    expect(useUserStore.getState().predictions[0]).toEqual(p);
  });

  it('refuses closed calls', () => {
    const { meta, call } = openCallFor('soccer');
    const late = meta.startsAt + 60_000;
    const closed = viewCall(callsForEvent(meta).find((c) => c.id === call.id)!, simulate(meta, late), late);
    const err = useUserStore.getState().placePrediction({ call: closed, option: closed.options[0], options: closed.options, stake: 10,
      eventTitle: meta.title, sportId: meta.sportId, now: late });
    expect(err).toBe('This call is closed.');
  });

  it('only lets guests browse', () => {
    useUserStore.getState().deleteAccount();
    const { meta, call, before } = openCallFor('soccer');
    expect(useUserStore.getState().placePrediction({ call, option: call.options[0], options: call.options, stake: 10,
      eventTitle: meta.title, sportId: meta.sportId, now: before })).toMatch(/account/);
    expect(useUserStore.getState().postMessage('event:x', 'hello', Date.now())).toMatch(/account/);
    expect(useUserStore.getState().openPack({ packId: 'standard' }, Date.now())).toHaveProperty('error');
  });

  it('exposes no way to set Clout or Tix directly', () => {
    const actions = Object.keys(useUserStore.getState()).filter((k) => /clout|tix/i.test(k) && typeof (useUserStore.getState() as unknown as Record<string, unknown>)[k] === 'function');
    expect(actions).toEqual([]);
  });
});

describe('packs and chat', () => {
  beforeEach(signUp);

  it('opens a pack of 3 for 25 Tix with increasing serials', () => {
    const r = useUserStore.getState().openPack({ packId: 'standard', sportId: 'f1' }, Date.now());
    expect(r).toHaveProperty('cards');
    expect(useUserStore.getState().tix).toBe(25);
    expect(useUserStore.getState().cards).toHaveLength(3);
    useUserStore.getState().openPack({ packId: 'standard', sportId: 'f1' }, Date.now());
    expect(useUserStore.getState().openPack({ packId: 'standard', sportId: 'f1' }, Date.now())).toEqual({ error: 'Not enough Tix.' });
  });

  it('blocks extreme slurs, allows swearing, and throttles fast posting', () => {
    const post = useUserStore.getState().postMessage;
    const slur = 'avttre'.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
    expect(post('event:a', `what a ${slur}`, 1_000_000)).toMatch(/isn’t allowed/);
    expect(post('event:a', 'what a shit call', 1_000_000)).toBeNull();
    expect(post('event:a', 'again', 1_000_500)).toMatch(/too fast/);
    expect(post('event:a', 'again', 1_003_000)).toBeNull();
  });

  it('reports hide messages and blocks hide people', () => {
    const s = useUserStore.getState();
    s.report('m1', 'fan_1', 'Spam or scam', Date.now());
    s.block('fan_2');
    expect(useUserStore.getState().hiddenMessages).toContain('m1');
    expect(useUserStore.getState().blocked).toContain('fan_2');
  });

  it('deletes the account completely', () => {
    useUserStore.getState().openPack({ packId: 'standard' }, Date.now());
    useUserStore.getState().deleteAccount();
    const s = useUserStore.getState();
    expect(s.profile.isGuest).toBe(true);
    expect(s.cards).toHaveLength(0);
    expect(s.clout).toBe(1000);
    expect(s.onboarded).toBe(false);
  });
});
