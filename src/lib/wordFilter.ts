// The word filter for chat, usernames, and Section names. Swearing is allowed; only a short
// list of the most extreme racial slurs is blocked. It normalizes common tricks (l33t speak,
// repeated letters, separators, plurals) before checking, and matches whole words so
// 'Scunthorpe'-style false alarms are rare. Everything else is handled by Report and Block.

/** ROT13, so the slurs below never appear as plain text in the code. */
const rot13 = (s: string) =>
  s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

/**
 * The only blocked words: extreme racial slurs, stored ROT13-encoded. Slurs that are also
 * real names in sport (a common Spanish nickname, a country) are left out on purpose.
 */
const BLOCKED = ['avttre', 'avttn', 'jrgonpx'].map(rot13);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
};

function normalizeWord(word: string): string {
  const lowered = word
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('');
  const lettersOnly = lowered.replace(/[^a-z]/g, '');
  return lettersOnly.replace(/(.)\1{2,}/g, '$1$1'); // 'niiiigg' -> 'niigg'
}

/** The word as typed, with repeats collapsed, and without a plural ending. */
function variants(word: string): string[] {
  const out = new Set([word, word.replace(/(.)\1+/g, '$1')]);
  for (const w of [...out]) {
    if (/[sz]$/.test(w)) out.add(w.slice(0, -1));
    if (w.endsWith('es')) out.add(w.slice(0, -2));
  }
  return [...out];
}

const isBlocked = (raw: string) => variants(normalizeWord(raw)).some((v) => BLOCKED.includes(v));

/** True when the text contains a blocked word. */
export function containsBlockedWord(text: string): boolean {
  const words = text.split(/[\s,.;:?!"'()[\]{}<>/\\|_-]+/).filter(Boolean);
  if (words.some(isBlocked)) return true;
  // Catch blocked words typed letter by letter with spaces or dots.
  const squashed = normalizeWord(text.replace(/\s+/g, ''));
  return BLOCKED.some(
    (w) => w.length >= 4 && squashed.includes(w) && /(\b\w\b[\s.]*){4,}/.test(text),
  );
}

/** Replace blocked words with asterisks, keeping the first letter. */
export function maskBlockedWords(text: string): string {
  return text.replace(/[^\s]+/g, (raw) =>
    isBlocked(raw) ? raw[0] + '*'.repeat(Math.max(2, raw.length - 1)) : raw,
  );
}

export const FILTER_MESSAGE = 'That word isn’t allowed on Stands. Please rephrase that.';
