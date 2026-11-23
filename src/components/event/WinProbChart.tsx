// Win probability over the game: the line climbs toward the side that is
// winning, shaded in their colours, with dots on the big moments.
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { competitorById, winProbabilitySeries } from '@/data/api';
import type { EventState } from '@/data/types';
import { asPercents, sportHasDraws } from '@/logic/winProbability';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

import { playIcon } from './playIcons';
import { sideColors } from './teamColor';

const HEIGHT = 150;
const PAD_TOP = 10;
const PAD_BOTTOM = 10;
/** Room on the left for the team labels, so they never sit on the line. */
const GUTTER = 34;
/** Fights barely move between knockdowns, so a chart says little there. */
const NO_CHART = new Set(['mma', 'boxing']);

/** Home share of the outcome, 0..1, where 0.5 is level (draws split evenly). */
function homeShare(p: { home: number; draw: number; away: number }): number {
  return p.home + p.draw / 2;
}

export function WinProbChart({ state, now, title = 'Win probability' }: { state: EventState; now: number; title?: string }) {
  const [width, setWidth] = useState(0);
  // Recompute at most every 10 seconds of game time; past samples are cached anyway.
  const bucket = Math.floor(now / 10_000);
  const series = useMemo(() => winProbabilitySeries(state, bucket * 10_000), [state, bucket]);
  const [homeId, awayId] = state.meta.competitorIds;
  const [homeColor, awayColor] = sideColors(homeId, awayId);
  const draws = sportHasDraws(state.meta.sportId);
  const ids = useMemo(() => `wp${state.meta.id.replace(/[^a-zA-Z0-9]/g, '')}`, [state.meta.id]);

  if (!series || series.points.length < 2 || NO_CHART.has(state.meta.sportId)) return null;
  const last = series.points[series.points.length - 1];
  const pct = asPercents(last, draws);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (t: number) => GUTTER + t * Math.max(1, width - GUTTER - 4);
  const y = (share: number) => PAD_TOP + (1 - share) * plotH;
  const mid = y(0.5);
  const pts = series.points.map((p) => [x(p.t), y(homeShare(p))] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${mid} L${pts[0][0].toFixed(1)},${mid} Z`;
  const shareAt = (t: number) => {
    const list = series.points;
    for (let i = 1; i < list.length; i++) {
      if (list[i].t >= t) {
        const a = list[i - 1];
        const b = list[i];
        const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
        return homeShare(a) + (homeShare(b) - homeShare(a)) * f;
      }
    }
    return homeShare(list[list.length - 1]);
  };
  const homeName = competitorById(homeId)?.shortName ?? 'HOME';
  const awayName = competitorById(awayId)?.shortName ?? 'AWAY';

  return (
    <View style={styles.card} accessibilityLabel={`${title}. Now ${homeName} ${pct.home}%,${draws ? ` draw ${pct.draw}%,` : ''} ${awayName} ${pct.away}%`}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.legend}>
          <Text style={[styles.legendVal, { color: homeColor }]}>{homeName} {pct.home}%</Text>
          {draws ? <Text style={[styles.legendVal, { color: colors.textDim }]}>D {pct.draw}%</Text> : null}
          <Text style={[styles.legendVal, { color: awayColor }]}>{awayName} {pct.away}%</Text>
        </View>
      </View>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <ClipPath id={`${ids}top`}><Rect x={0} y={0} width={width} height={mid} /></ClipPath>
              <ClipPath id={`${ids}bot`}><Rect x={0} y={mid} width={width} height={HEIGHT - mid} /></ClipPath>
            </Defs>
            {[0.25, 0.75].map((g) => (
              <Line key={g} x1={GUTTER} x2={width} y1={y(g)} y2={y(g)} stroke={colors.line} strokeWidth={1} strokeDasharray="2,4" />
            ))}
            {[0.25, 0.5, 0.75].map((g) => (
              <Line key={`v${g}`} x1={x(g)} x2={x(g)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke={colors.line} strokeWidth={1} strokeDasharray="2,4" />
            ))}
            <Path d={area} fill={homeColor} fillOpacity={0.28} clipPath={`url(#${ids}top)`} />
            <Path d={area} fill={awayColor} fillOpacity={0.28} clipPath={`url(#${ids}bot)`} />
            <Line x1={GUTTER} x2={width} y1={mid} y2={mid} stroke={colors.textDim} strokeOpacity={0.5} strokeWidth={1} />
            <Path d={line} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {series.markers.map((m) => {
              const cx = x(m.t);
              const cy = y(shareAt(m.t));
              const c = m.competitorId === homeId ? homeColor : m.competitorId === awayId ? awayColor : colors.accent;
              return (
                <Circle key={m.playId} cx={cx} cy={cy} r={4.5} fill={c} stroke={colors.bg} strokeWidth={2} />
              );
            })}
            {state.status === 'live' ? (
              <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={5} fill={colors.live} stroke={colors.text} strokeWidth={2} />
            ) : null}
            <SvgText x={2} y={PAD_TOP + 10} fontSize={12} fill={homeColor} fontFamily={fonts.heavy}>{homeName}</SvgText>
            <SvgText x={2} y={mid + 4} fontSize={10} fill={colors.textDim} fontFamily={fonts.bold}>50%</SvgText>
            <SvgText x={2} y={HEIGHT - PAD_BOTTOM} fontSize={12} fill={awayColor} fontFamily={fonts.heavy}>{awayName}</SvgText>
          </Svg>
        ) : null}
      </View>
      {series.markers.length > 0 ? (
        <Text style={styles.markers} numberOfLines={2}>
          {series.markers.slice(-6).map((m) => `${playIcon(m.tag, state.meta.sportId)} ${m.clock}`).join('   ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, padding: space.md, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { ...type.caps, fontSize: 13, color: colors.textDim, flex: 1 },
  legend: { flexDirection: 'row', gap: space.sm },
  legendVal: { fontFamily: fonts.heavy, fontSize: 14, fontVariant: ['tabular-nums'] },
  markers: { fontSize: 12, color: colors.textDim },
});
