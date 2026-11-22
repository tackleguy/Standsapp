import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/theme/tokens';

import { Header, Screen } from './ui/Screen';

export function DocPage({ title, updated, sections }: { title: string; updated: string; sections: { heading: string; body: string[] }[] }) {
  return (
    <Screen>
      <Header title={title} subtitle={`Last updated ${updated}`} back />
      <ScrollView contentContainerStyle={styles.body}>
        {sections.map((s) => (
          <View key={s.heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">{s.heading}</Text>
            {s.body.map((p, i) => <Text key={i} style={styles.p}>{p}</Text>)}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.xl, paddingBottom: 80, maxWidth: 680, width: '100%', alignSelf: 'center' },
  section: { gap: space.sm },
  heading: { ...type.title, color: colors.text },
  p: { ...type.body, color: colors.textDim },
});
