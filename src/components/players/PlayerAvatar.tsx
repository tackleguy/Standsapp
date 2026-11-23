// A generated player picture: a head-and-shoulders silhouette in the team's kit
// with the jersey number, and the team badge in the corner. Never a photo.
import { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { competitorById } from '@/data/api';
import { playerById } from '@/data/playerApi';
import { inkOn, mix, readableOnDark } from '@/lib/color';
import { hashText } from '@/lib/random';
import { colors } from '@/theme/tokens';

import { CompetitorBadge } from '../Badge';

const SKIN = ['#8D5524', '#C68642', '#E0AC69', '#F1C27D', '#FFDBAC', '#6B4226', '#A0662F'];

function PlayerAvatarImpl({ playerId, size = 48, badge = true }: { playerId: string; size?: number; badge?: boolean }) {
  const gid = `pa-${useId().replace(/[^\w-]/g, '')}`;
  const p = playerById(playerId);
  const team = competitorById(p?.teamId);
  const kit = team?.colors ?? competitorById(p?.sideId)?.colors ?? ['#3A4660', '#9AA6BD'];
  const main = kit[0];
  const trim = kit[1];
  const bg = mix(readableOnDark(main), colors.bg, 0.55);
  const skin = SKIN[hashText(playerId) % SKIN.length];
  const ink = inkOn(main);
  const label = p?.number !== null && p?.number !== undefined ? String(p.number) : (p?.short ?? '?').slice(0, 1);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={mix(bg, '#FFFFFF', 0.12)} />
            <Stop offset="1" stopColor={bg} />
          </LinearGradient>
        </Defs>
        <Circle cx={50} cy={50} r={49} fill={`url(#${gid})`} />
        {/* Shoulders in the team kit, with a trim collar. */}
        <Path d="M14 100 Q16 72 36 66 L64 66 Q84 72 86 100 Z" fill={main} />
        <Path d="M40 66 Q50 76 60 66" stroke={trim} strokeWidth={4} fill="none" />
        {/* Neck and head. */}
        <Path d="M43 56 L57 56 L58 68 Q50 72 42 68 Z" fill={skin} />
        <Circle cx={50} cy={42} r={16} fill={skin} />
        <Path d="M34 40 Q34 24 50 24 Q66 24 66 40 Q60 31 50 31 Q40 31 34 40 Z" fill={mix(skin, '#000000', 0.55)} />
        <SvgText x={50} y={94} fontSize={label.length > 1 ? 17 : 19} fontWeight="900" fill={ink} textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
          {label}
        </SvgText>
      </Svg>
      {badge && team ? (
        <View style={{ position: 'absolute', right: -size * 0.06, bottom: -size * 0.04 }}>
          <CompetitorBadge id={team.id} size={Math.max(14, Math.round(size * 0.36))} />
        </View>
      ) : null}
    </View>
  );
}

export const PlayerAvatar = memo(PlayerAvatarImpl);
