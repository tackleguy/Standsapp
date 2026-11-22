// A basic bad-word filter for chat, usernames, and Section names.
// It normalizes common tricks (l33t speak, repeated letters, separators) before
// checking, and matches whole words so "Scunthorpe"-style false alarms are rare.

const BLOCKED = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch',
  'bastard', 'asshole', 'arsehole', 'dick', 'dickhead', 'cock', 'cunt', 'pussy',
  'twat', 'wanker', 'prick', 'slut', 'whore', 'douche', 'douchebag', 'jackass',
  'retard', 'retarded', 'nazi', 'rape', 'rapist', 'kys', 'killyourself',
];

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
};

function normalizeWord(word: string): string {
  const lowered = word.toLowerCase().split('').map((ch) => LEET[ch] ?? ch).join('');
  const lettersOnly = lowered.replace(/[^a-z]/g, '');
  return lettersOnly.replace(/(.)\1{2,}/g, '$1$1'); // "fuuuuck" -> "fuuck"
}

function variants(word: string): string[] {
  const collapsed = word.replace(/(.)\1+/g, '$1'); // "fuuck" -> "fuck"
  return collapsed === word ? [word] : [word, collapsed];
}

/** True when the text contains a blocked word. */
export function containsBlockedWord(text: string): boolean {
  const words = text.split(/[\s,.;:?!"'()[\]{}<>/\\|_-]+/).filter(Boolean);
  for (const raw of words) {
    for (const v of variants(normalizeWord(raw))) {
      if (BLOCKED.includes(v)) return true;
    }
  }
  // Catch words spelled out with spaces or dots: "f u c k", "s.h.i.t"
  const squashed = normalizeWord(text.replace(/\s+/g, ''));
  return BLOCKED.some((w) => w.length >= 4 && squashed.includes(w) && /(\b\w\b[\s.]*){4,}/.test(text));
}

/** Replace blocked words with asterisks, keeping the first letter. */
export function maskBlockedWords(text: string): string {
  return text.replace(/[^\s]+/g, (raw) => {
    const isBad = variants(normalizeWord(raw)).some((v) => BLOCKED.includes(v));
    return isBad ? raw[0] + '*'.repeat(Math.max(2, raw.length - 1)) : raw;
  });
}

export const FILTER_MESSAGE = 'Let’s keep the stands friendly. Please rephrase that.';
