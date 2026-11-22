import { fireEvent, render, screen } from '@testing-library/react-native';

import { StakePicker } from '@/components/calls/StakePicker';
import { ScoreCard, type CardEvent } from '@/components/event/ScoreCard';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const base = { startsAt: '2026-11-22T14:00:00Z', periodLabel: null, competitionName: 'Demo League' };

const h2h: CardEvent = {
  ...base, id: 'e1', title: 'Harbor City v Northgate United', format: 'head_to_head', status: 'live', periodLabel: "67'",
  entries: [
    { competitorId: 'a', name: 'Harbor City', shortName: 'HAR', kind: 'team', role: 'home', score: 2, scoreText: null, position: null, isWinner: null },
    { competitorId: 'b', name: 'Northgate United', shortName: 'NOR', kind: 'team', role: 'away', score: 1, scoreText: null, position: null, isWinner: null },
  ],
};
const race: CardEvent = {
  ...base, id: 'e2', title: 'Demo Grand Prix', format: 'race', status: 'finished',
  entries: ['Arlo Vale', 'Mateo Okoro', 'Jonas Lindqvist', 'Ren Tanaka'].map((name, i) => ({
    competitorId: `d${i}`, name, shortName: name.slice(-3).toUpperCase(), kind: 'athlete' as const, role: 'entrant' as const,
    score: null, scoreText: i === 0 ? 'Winner' : `+${i * 4}.2s`, position: 4 - i, isWinner: i === 3,
  })),
};
const innings: CardEvent = {
  ...base, id: 'e3', title: 'Coastal Kings v Desert Falcons', format: 'innings', status: 'live', periodLabel: 'Need 45 from 30 balls',
  entries: [
    { competitorId: 'c', name: 'Coastal Kings', shortName: 'CK', kind: 'team', role: 'home', score: 187, scoreText: '187/4 (20.0 ov)', position: null, isWinner: null },
    { competitorId: 'd', name: 'Desert Falcons', shortName: 'DF', kind: 'team', role: 'away', score: 143, scoreText: '143/5 (15.0 ov)', position: null, isWinner: null },
  ],
};

describe('ScoreCard', () => {
  it('renders a head-to-head event with both scores', async () => {
    await render(<ScoreCard event={h2h} onPress={() => undefined} />);
    expect(screen.getByText('Harbor City')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText("67'")).toBeTruthy();
  });

  it('renders a race with only the top three in finishing order', async () => {
    await render(<ScoreCard event={race} onPress={() => undefined} />);
    expect(screen.getByText('Ren Tanaka')).toBeTruthy(); // position 1
    expect(screen.queryByText('Arlo Vale')).toBeNull(); // position 4 is hidden
    expect(screen.getByText('Final')).toBeTruthy();
  });

  it('renders a cricket innings score', async () => {
    await render(<ScoreCard event={innings} onPress={() => undefined} />);
    expect(screen.getByText('187/4 (20.0 ov)')).toBeTruthy();
    expect(screen.getByText('Need 45 from 30 balls')).toBeTruthy();
  });

  it('renders an empty line-up', async () => {
    await render(<ScoreCard event={{ ...race, status: 'scheduled', entries: [] }} onPress={() => undefined} />);
    expect(screen.getByText('Line-up to be announced')).toBeTruthy();
  });

  it('is pressable', async () => {
    const onPress = jest.fn();
    await render(<ScoreCard event={h2h} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('StakePicker', () => {
  it('never goes below 10 or above 500', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<StakePicker value={10} onChange={onChange} balance={10_000} />);
    await fireEvent.press(screen.getByLabelText('Decrease stake by 10'));
    expect(onChange).not.toHaveBeenCalled(); // disabled at the minimum
    await rerender(<StakePicker value={500} onChange={onChange} balance={10_000} />);
    await fireEvent.press(screen.getByLabelText('Increase stake by 10'));
    expect(onChange).not.toHaveBeenCalled(); // disabled at the maximum
    await fireEvent.press(screen.getByLabelText('Stake 250 Clout'));
    expect(onChange).toHaveBeenCalledWith(250);
  });

  it('will not offer stakes the fan cannot afford', async () => {
    const onChange = jest.fn();
    await render(<StakePicker value={10} onChange={onChange} balance={60} />);
    await fireEvent.press(screen.getByLabelText('Stake 100 Clout'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
