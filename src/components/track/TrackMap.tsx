// The live track map: the circuit drawn as a racing line, every car as a
// numbered dot in its team colour, moving in real time.
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { competitorById } from '@/data/demo/world';
import type { RaceSnapshot } from '@/data/demo/engines/race';
import { badgeFor } from '@/lib/badge';
import { TRACK_VIEWBOX, trackFor } from '@/lib/tracks';
import { colors, radius } from '@/theme/tokens';

const FONT = '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

export function teamColors(competitorId: string): { fill: string; ink: string } {
  const c = competitorById(competitorId);
  const team = competitorById(c?.parentId);
  const spec = badgeFor(team?.name ?? c?.name ?? '?', team?.shortName, 'team', team?.colors ?? null);
  return { fill: spec.background, ink: spec.foreground };
}

interface Props {
  circuit: string;
  snapshot: RaceSnapshot;
  selectedId: string | null;
  followed: Set<string>;
  onSelect: (id: string) => void;
}

function TrackMapImpl({ circuit, snapshot, selectedId, followed, onSelect }: Props) {
  const track = useMemo(() => trackFor(circuit), [circuit]);
  const start = track.pointAt(0);
  const angle = track.angleAt(0);
  const sectors = [1 / 3, 2 / 3].map((f) => ({ p: track.pointAt(f), a: track.angleAt(f) }));
  // Draw the leader last so it sits on top of the pack.
  const cars = [...snapshot.cars].filter((c) => !c.retired).reverse();
  const leader = snapshot.cars.find((c) => !c.retired);
  const scPoint = snapshot.safetyCar && leader ? track.pointAt(leader.lapFloat + 0.012) : null;

  return (
    <View style={styles.wrap} accessibilityLabel={`Live track map of ${circuit}`}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${TRACK_VIEWBOX.width} ${TRACK_VIEWBOX.height}`}>
        <Rect x={0} y={0} width={TRACK_VIEWBOX.width} height={TRACK_VIEWBOX.height} fill={colors.bg} />
        {/* Kerb glow, tarmac, and the centre line */}
        <Path d={track.path} stroke="rgba(255,182,39,0.12)" strokeWidth={76} fill="none" strokeLinejoin="round" />
        <Path d={track.path} stroke={colors.line} strokeWidth={56} fill="none" strokeLinejoin="round" />
        <Path d={track.path} stroke={colors.surfaceHigh} strokeWidth={44} fill="none" strokeLinejoin="round" />
        <Path d={track.path} stroke="rgba(244,246,250,0.12)" strokeWidth={3} strokeDasharray="14 18" fill="none" />
        {/* Sector markers */}
        {sectors.map((s, i) => (
          <G key={i} transform={`translate(${s.p.x} ${s.p.y}) rotate(${s.a + 90})`}>
            <Line x1={-28} y1={0} x2={28} y2={0} stroke={i === 0 ? '#4DA3FF' : '#B47CFF'} strokeWidth={6} />
          </G>
        ))}
        {/* Start/finish line, chequered */}
        <G transform={`translate(${start.x} ${start.y}) rotate(${angle + 90})`}>
          {Array.from({ length: 6 }, (_, i) => (
            <Rect key={i} x={-30 + i * 10} y={-6} width={10} height={6} fill={i % 2 ? '#111' : '#fff'} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <Rect key={`b${i}`} x={-30 + i * 10} y={0} width={10} height={6} fill={i % 2 ? '#fff' : '#111'} />
          ))}
        </G>
        {scPoint ? (
          <G transform={`translate(${scPoint.x} ${scPoint.y})`}>
            <Rect x={-34} y={-18} width={68} height={36} rx={9} fill={colors.accent} />
            <SvgText fontFamily={FONT} x={0} y={9} fontSize={24} fontWeight="900" fill={colors.accentInk} textAnchor="middle">SC</SvgText>
          </G>
        ) : null}
        {cars.map((car) => {
          const p = track.pointAt(car.lapFloat);
          const { fill, ink } = teamColors(car.competitorId);
          const selected = car.competitorId === selectedId;
          const isLeader = car.position === 1;
          const isFollowed = followed.has(car.competitorId);
          const r = selected ? 30 : 23;
          const code = competitorById(car.competitorId)?.shortName ?? '';
          const showTag = selected || isFollowed || car.position <= 3;
          return (
            <G key={car.competitorId} onPress={() => onSelect(car.competitorId)}>
              {(isLeader || selected || isFollowed) && (
                <Circle cx={p.x} cy={p.y} r={r + 7} fill="none" stroke={selected ? '#FFFFFF' : isLeader ? colors.accent : colors.win} strokeWidth={5} />
              )}
              <Circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={car.inPit ? colors.accent : '#0A0E17'} strokeWidth={car.inPit ? 5 : 3} />
              <SvgText fontFamily={FONT} x={p.x} y={p.y + (selected ? 9 : 8)} fontSize={selected ? 26 : 22} fontWeight="900" fill={ink} textAnchor="middle">{car.position}</SvgText>
              {showTag ? (
                <G>
                  <Rect x={p.x + r + 6} y={p.y - 19} width={code.length * 19 + 18} height={38} rx={8} fill="rgba(10,14,23,0.88)" />
                  <SvgText fontFamily={FONT} x={p.x + r + 15} y={p.y + 9} fontSize={25} fontWeight="800" fill={car.inPit ? colors.accent : colors.text}>{car.inPit ? 'PIT' : code}</SvgText>
                </G>
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

export const TrackMap = memo(TrackMapImpl);

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: TRACK_VIEWBOX.width / TRACK_VIEWBOX.height, borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
});
