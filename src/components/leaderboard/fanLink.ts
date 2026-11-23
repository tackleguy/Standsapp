// Where a fan's name or avatar should take you: their profile, or Me for yourself.
import type { Href } from 'expo-router';

export function fanHref(id: string): Href {
  if (id === 'me') return '/me';
  return { pathname: '/fan/[id]', params: { id } };
}
