import { Tabs } from 'expo-router/js-tabs';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colors } from '@/theme/tokens';

const tab = (title: string, icon: IconName, iconOn: IconName) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: unknown }) => (
    <Icon name={focused ? iconOn : icon} size={24} color={typeof color === 'string' ? color : colors.textDim} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'pulse-outline', 'pulse')} />
      <Tabs.Screen name="calls" options={tab('Calls', 'flash-outline', 'flash')} />
      <Tabs.Screen name="cards" options={tab('Cards', 'albums-outline', 'albums')} />
      <Tabs.Screen name="sections" options={tab('Sections', 'people-outline', 'people')} />
      <Tabs.Screen name="me" options={tab('Me', 'person-circle-outline', 'person-circle')} />
    </Tabs>
  );
}
