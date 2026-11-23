// Emoji that float up the chat: yours when you tap a quick reaction, and the
// whole crowd's when something big happens. Purely decorative.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

export interface Floater {
  id: number;
  emoji: string;
  x: number;
  drift: number;
  rise: number;
  size: number;
  duration: number;
}

const MAX = 22;

export function useFloaters(enabled: boolean) {
  const [items, setItems] = useState<Floater[]>([]);
  const counter = useRef(0);
  const spawn = useCallback((emoji: string, big = false) => {
    if (!enabled) return;
    counter.current += 1;
    const id = counter.current;
    const f: Floater = {
      id, emoji,
      x: Math.random() * 70,
      drift: (8 + Math.random() * 22) * (Math.random() < 0.5 ? -1 : 1),
      rise: 220 + Math.random() * 200,
      size: big ? 34 : 20 + Math.random() * 10,
      duration: 1900 + Math.random() * 1500,
    };
    setItems((cur) => [...cur.slice(-(MAX - 1)), f]);
  }, [enabled]);
  const remove = useCallback((id: number) => setItems((cur) => cur.filter((f) => f.id !== id)), []);
  return { items, spawn, remove };
}

function Particle({ f, onDone }: { f: Floater; onDone: (id: number) => void }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: f.duration, useNativeDriver: Platform.OS !== 'web' });
    anim.start(() => onDone(f.id));
    return () => anim.stop();
  }, [t, f, onDone]);
  return (
    <Animated.Text
      style={[styles.particle, {
        right: f.x, fontSize: f.size,
        opacity: t.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -f.rise] }) },
          { translateX: t.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, f.drift, -f.drift * 0.4, f.drift * 0.7] }) },
          { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.15, 0.9] }) },
        ],
      }]}
    >
      {f.emoji}
    </Animated.Text>
  );
}

export function FloatingLayer({ items, onDone }: { items: Floater[]; onDone: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <Animated.View pointerEvents="none" style={styles.layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {items.map((f) => <Particle key={f.id} f={f} onDone={onDone} />)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 8, bottom: 4, width: 120, height: 440 },
  particle: { position: 'absolute', bottom: 0 },
});
