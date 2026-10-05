import en from './en.json';
import hi from './hi.json';

// Every language file must have exactly the keys en.json has, with the same {{placeholders}},
// or a screen would show a raw key or drop a number. And no string may use the words SPEC §7
// rules out.

type Tree = { [key: string]: string | Tree };

/** Every string in a file, keyed by its dotted path ("today.ring.left"). */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result.set(path, value);
    else for (const [k, v] of flatten(value, path)) result.set(k, v);
  }
  return result;
}

/** The {{placeholders}} in a string, sorted. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

const english = flatten(en as Tree);
const languages: Record<string, Map<string, string>> = { hi: flatten(hi as Tree) };

describe.each(Object.entries(languages))('%s.json', (_code, strings) => {
  it('has every key en.json has, and no others', () => {
    expect([...strings.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('uses the same placeholders as English in every string', () => {
    const different = [...english].filter(
      ([key, text]) =>
        strings.has(key) && placeholders(strings.get(key)!).join() !== placeholders(text).join(),
    );
    expect(different.map(([key]) => key)).toEqual([]);
  });

  it('leaves no string empty', () => {
    expect([...strings].filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
  });
});

describe('wording rules (SPEC §7)', () => {
  // Rule 1's list, plus "over" on its own (rule 2: "more than planned" / "above your target").
  const bannedEnglish = [
    'bad',
    'cheat',
    'junk',
    'guilty',
    'guilt',
    'failed',
    'fail',
    'over budget',
    'exceeded',
    'exceed',
    'warning',
    'blew it',
    'sin',
    'naughty',
    'damage',
    'over',
    'lost your streak',
  ];
  // The same ideas in Hindi: bad, cheat, junk, guilty/fault, failed, warning, sin, damage/harm,
  // "ate too much", "broke/lost (the streak)".
  const bannedHindi = [
    'बुरा',
    'बुरी',
    'ख़राब',
    'खराब',
    'धोखा',
    'जंक',
    'दोषी',
    'ग़लती आपकी',
    'असफल',
    'फ़ेल',
    'चेतावनी',
    'पाप',
    'नुकसान',
    'ज़्यादा खा लिया',
    'टूट गया',
    'खो दिया',
  ];

  const hits = (strings: Map<string, string>, words: string[], wholeWords: boolean) =>
    [...strings].flatMap(([key, text]) =>
      words
        .filter((word) =>
          wholeWords
            ? new RegExp(`\\b${word}\\b`, 'i').test(text)
            : text.toLowerCase().includes(word.toLowerCase()),
        )
        .map((word) => `${key}: "${word}"`),
    );

  it('en.json uses none of the banned words', () => {
    expect(hits(english, bannedEnglish, true)).toEqual([]);
  });

  it('hi.json uses none of the banned words', () => {
    expect(hits(languages.hi, bannedHindi, false)).toEqual([]);
  });

  it('has no exclamation marks in anything about weight or limits (rule 6)', () => {
    const sections = ['weight', 'alerts', 'floor', 'goals', 'bands'];
    for (const strings of [english, languages.hi]) {
      const loud = [...strings].filter(
        ([key, text]) => sections.includes(key.split('.')[0]) && text.includes('!'),
      );
      expect(loud.map(([key]) => key)).toEqual([]);
    }
  });
});
