import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { LiveDot } from '@/components/ui/LiveDot';
import { Screen } from '@/components/ui/Screen';
import { SPORTS } from '@/config/sports';
import { colors, space, type } from '@/theme/tokens';

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <View style={styles.glow} />
          <Text style={styles.word} accessibilityRole="header">Stands</Text>
          <Text style={styles.tag}>Every sport. One crowd.</Text>
          <View style={styles.liveRow}><LiveDot /><Text style={styles.live}>Live scores, play-by-play, and the chat — {SPORTS.length} sports</Text></View>
        </View>
        <View style={styles.points}>
          {[
            ['Rate the big moments', 'Every play, scored 1 to 10 by the crowd.'],
            ['Make the call', 'Predict with free Clout. No real money, ever.'],
            ['Collect Stand Cards', 'Open packs with Tix you earn by showing up.'],
            ['Find your Section', 'Group chats and leaderboards with your people.'],
          ].map(([t, b]) => (
            <View key={t} style={styles.point}>
              <Text style={styles.pointTitle}>{t}</Text>
              <Text style={styles.pointBody}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={styles.bottom}>
          <Button label="Get started" icon="arrow-forward" onPress={() => router.push('/sports')} />
          <Text style={styles.legal}>
            Free to play. Ages 13+. By continuing you agree to our{' '}
            <Link href="/rules" style={styles.link}>community rules</Link> and{' '}
            <Link href="/privacy" style={styles.link}>privacy policy</Link>.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.xl, justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginTop: space.xxl, gap: space.sm },
  glow: { position: 'absolute', top: -60, left: '50%', marginLeft: -140, width: 280, height: 280, borderRadius: 140, backgroundColor: colors.accent, opacity: 0.08 },
  word: { fontSize: 64, fontWeight: '900', color: colors.text, letterSpacing: -2 },
  tag: { ...type.title, color: colors.accent },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  live: { ...type.label, color: colors.textDim },
  points: { gap: space.lg },
  point: { borderLeftWidth: 3, borderColor: colors.accent, paddingLeft: space.md },
  pointTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  pointBody: { ...type.body, color: colors.textDim },
  bottom: { gap: space.md },
  legal: { ...type.label, color: colors.textDim, textAlign: 'center', lineHeight: 18 },
  link: { color: colors.accent, textDecorationLine: 'underline' },
});
