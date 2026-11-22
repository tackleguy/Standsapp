// Account rules: usernames, display names, and the minimum age.
import { containsBlockedWord } from '@/lib/wordFilter';

import { MIN_AGE } from './rules';

export function validateUsername(username: string): string | null {
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return 'Use 3 to 20 lowercase letters, numbers, or underscores.';
  if (containsBlockedWord(username.replace(/_/g, ' '))) return 'Please choose a different username.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) return 'Display name must be 1 to 40 characters.';
  if (containsBlockedWord(trimmed)) return 'Please choose a different name.';
  return null;
}

/** Fans must be 13 or older. We ask only for the birth year. */
export function validateBirthYear(year: number, currentYear: number): string | null {
  if (!Number.isInteger(year) || year < 1900 || year > currentYear) return 'Enter a valid birth year.';
  if (currentYear - year < MIN_AGE) return `Sorry, Stands is for fans aged ${MIN_AGE} and over.`;
  return null;
}

export function validateEmail(email: string): string | null {
  if (email.trim() === '') return null; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'That email does not look right.';
}
