// Generated team and athlete badges, drawn with SVG. Never a real logo.
import { memo } from 'react';
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { competitorById } from '@/data/demo/world';
import { badgeFor } from '@/lib/badge';

interface BadgeProps {
  name: string;
  shortName?: string;
  kind?: 'team' | 'athlete';
  size?: number;
  colors?: readonly [string, string] | null;
}

function BadgeImpl({ name, shortName, kind = 'team', size = 32, colors }: BadgeProps) {
  const spec = badgeFor(name, shortName, kind, colors);
  const fontSize = spec.initials.length >= 3 ? 30 : 36;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {spec.shape === 'circle' && (
        <>
          <Circle cx={50} cy={50} r={48} fill={spec.background} />
          <Circle cx={50} cy={50} r={41} fill="none" stroke={spec.foreground} strokeOpacity={0.35} strokeWidth={3} />
        </>
      )}
      {spec.shape === 'shield' && (
        <>
          <Path d="M50 3 L93 16 L90 58 Q84 84 50 97 Q16 84 10 58 L7 16 Z" fill={spec.background} />
          <Path d="M50 12 L84 22 L82 56 Q77 77 50 88 Q23 77 18 56 L16 22 Z" fill="none" stroke={spec.foreground} strokeOpacity={0.35} strokeWidth={3} />
        </>
      )}
      {spec.shape === 'hex' && (
        <>
          <Polygon points="50,2 92,26 92,74 50,98 8,74 8,26" fill={spec.background} />
          <Polygon points="50,12 83,31 83,69 50,88 17,69 17,31" fill="none" stroke={spec.foreground} strokeOpacity={0.35} strokeWidth={3} />
        </>
      )}
      <SvgText x={50} y={50 + fontSize * 0.36} fontSize={fontSize} fontWeight="900" fill={spec.foreground} textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
        {spec.initials}
      </SvgText>
    </Svg>
  );
}

export const Badge = memo(BadgeImpl);

/** Badge for a competitor id from the data layer. */
export function CompetitorBadge({ id, size = 32 }: { id: string; size?: number }) {
  const c = competitorById(id);
  if (!c) return <Badge name="?" size={size} />;
  return <Badge name={c.name} shortName={c.shortName} kind={c.kind} size={size} colors={c.colors} />;
}
