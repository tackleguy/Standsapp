import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { sportById } from '@/config/sports';
import { colors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** The glyph for a sport (never a league logo). */
export function sportIcon(sportId: string): IconName {
  const name = sportById(sportId)?.icon ?? 'trophy';
  return (name in Ionicons.glyphMap ? name : 'trophy') as IconName;
}
