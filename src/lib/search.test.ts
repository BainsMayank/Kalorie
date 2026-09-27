import {
  MatchTier,
  TYPO_TIER_OFFSET,
  allowedTypos,
  correctedQueries,
  editDistance,
  foodAliases,
  ftsQuery,
  matchFood,
  nameAlternatives,
  normalizeText,
  phoneticKey,
  phoneticText,
  queryWords,
  rankFoods,
  typoCorrections,
} from './search';

describe('normalizeText', () => {
  it('lowercases and turns punctuation into single spaces', () => {
    expect(normalizeText('Chapati/Roti')).toBe('chapati roti');
    expect(normalizeText("  Okra/Lady's fingers fry  ")).toBe('okra lady s fingers fry');
  });

  it('removes accents', () => {
    expect(normalizeText('Éclair')).toBe('eclair');
  });
});

describe('phoneticKey', () => {
  it.each([
    ['daal', 'dal'],
    ['dal', 'dal'],
    ['pappad', 'papad'],
    ['paneer', 'panir'],
    ['panir', 'panir'],
    ['moong', 'mung'],
    ['kheer', 'khir'],
    ['sooji', 'suji'],
    ['wada', 'vada'],
    ['phulka', 'fulka'],
  ])('%s → %s', (word, key) => {
    expect(phoneticKey(word)).toBe(key);
  });
});

describe('phoneticText', () => {
  it('normalises, then keys every word', () => {
    expect(phoneticText('Daal Makhani')).toBe('dal makhani');
    expect(phoneticText('Moong-Daal Cheela')).toBe('mung dal chila');
  });

  it('gives both spellings of cheela / chilla the same key', () => {
    expect(phoneticText('cheela')).toBe(phoneticText('chilla'));
  });
});

describe('queryWords', () => {
  it('normalises and splits what the user typed', () => {
    expect(queryWords('  Daal, Tadka ')).toEqual(['daal', 'tadka']);
    expect(queryWords(' ,/ ')).toEqual([]);
  });
});

describe('ftsQuery', () => {
  it('searches each word as a prefix, as typed and by sound', () => {
    expect(ftsQuery(['daal', 'tadka'])).toBe('("daal"* OR "dal"*) AND "tadka"*');
  });

  it('adds typo corrections as exact words', () => {
    expect(ftsQuery(['biryni'], [['biryani', 'biriyani']])).toBe(
      '("biryni"* OR "biryani" OR "biriyani")',
    );
  });
});

describe('correctedQueries', () => {
  it('lists every mix of corrections, without the original', () => {
    expect(correctedQueries(['panner', 'tika'], [['panir'], ['tikka']])).toEqual([
      ['panner', 'tikka'],
      ['panir', 'tika'],
      ['panir', 'tikka'],
    ]);
  });
});

describe('nameAlternatives', () => {
  it('splits "a/b" names', () => {
    expect(nameAlternatives('Chapati/Roti')).toEqual(['chapati', 'roti']);
    expect(nameAlternatives('Dahi vadas/Dahi bhalla')).toEqual(['dahi vadas', 'dahi bhalla']);
  });

  it('swaps a single word into the longer part', () => {
    expect(nameAlternatives('Dal parantha/paratha')).toEqual(['dal parantha', 'dal paratha']);
    expect(nameAlternatives('Suji/Rava daliya')).toEqual(['suji daliya', 'rava daliya']);
  });
});

describe('foodAliases', () => {
  it('uses the part before the comma for IFCT and USDA names', () => {
    expect(foodAliases('Okra, raw', null, true)).toEqual(['okra raw', 'okra']);
  });

  it('does not for INDB names, which aren’t written that way', () => {
    expect(foodAliases('Paneer, apple and pineapple salad', null, false)).toEqual([
      'paneer apple and pineapple salad',
    ]);
  });

  it('includes the Hindi name and its alternatives', () => {
    expect(foodAliases('Curd rice', 'Dahi bhaat/Dahi chawal', false)).toEqual([
      'curd rice',
      'dahi bhaat',
      'dahi chawal',
    ]);
  });
});

describe('matchFood', () => {
  const food = (name: string, nameHi: string | null = null, searchText?: string) => ({
    name,
    nameHi,
    headFirst: false,
    searchText,
  });

  it('ranks the kinds of match from best to worst', () => {
    expect(matchFood(['roti'], food('Chapati/Roti')).tier).toBe(MatchTier.exact);
    expect(matchFood(['dal'], food('Dal makhani')).tier).toBe(MatchTier.startsWith);
    expect(matchFood(['dal'], food('Mixed dal')).tier).toBe(MatchTier.allWords);
    expect(matchFood(['bhindi'], food('Stuffed okra', null, 'stuffed okra bhindi')).tier).toBe(
      MatchTier.synonym,
    );
    expect(matchFood(['dal'], food('Dalma')).tier).toBe(MatchTier.startsWithPartial);
    expect(matchFood(['mak'], food('Dal makhani')).tier).toBe(MatchTier.allWordsPartial);
    expect(matchFood(['dal'], food('Apple cinnamon pie', null, 'apple dalchini')).tier).toBe(
      MatchTier.synonymPartial,
    );
  });

  it('matches by sound and plural', () => {
    expect(matchFood(['daal'], food('Mixed dal')).tier).toBe(MatchTier.allWords);
    expect(matchFood(['banana'], { ...food('Bananas, raw'), headFirst: true }).tier).toBe(
      MatchTier.exact,
    );
  });

  it('matches the Hindi name', () => {
    expect(matchFood(['dahi'], food('Curd rice', 'Dahi bhaat')).tier).toBe(MatchTier.startsWith);
  });

  it('counts extra words in the best name', () => {
    expect(matchFood(['dal'], food('Dal makhani')).extraWords).toBe(1);
  });
});

describe('rankFoods', () => {
  const candidate = (id: number, name: string, searchRank: number) => ({
    id,
    name,
    nameHi: null,
    searchRank,
    headFirst: searchRank > 1,
  });

  it('orders by match, then source, then shorter name', () => {
    const ranked = rankFoods(
      [
        candidate(1, 'Okra, raw', 3),
        candidate(2, 'Stuffed okra', 1),
        candidate(3, 'Okra fry with onion', 1),
        candidate(4, 'Okra fry', 1),
      ],
      ['okra'],
    );
    expect(ranked.map((r) => r.food.id)).toEqual([1, 4, 3, 2]);
  });

  it('puts pinned foods first', () => {
    const ranked = rankFoods(
      [candidate(1, 'Curd rice', 1), candidate(2, 'Yogurt, plain', 3)],
      ['dahi'],
      {
        pinnedIds: new Set([2]),
      },
    );
    expect(ranked[0].food.id).toBe(2);
  });

  it('puts foods found only by typo correction after the rest', () => {
    const ranked = rankFoods(
      [candidate(1, 'Paneer', 2), candidate(2, 'Paaner do pyaza', 1)],
      ['paner'],
      { typoIds: new Set([1]), typoQueries: [['panir']] },
    );
    expect(ranked.map((r) => r.food.id)).toEqual([2, 1]);
    expect(ranked[1].tier).toBe(MatchTier.exact + TYPO_TIER_OFFSET);
  });
});

describe('editDistance', () => {
  it('counts inserted, deleted and changed letters', () => {
    expect(editDistance('biryni', 'biryani', 2)).toBe(1);
    expect(editDistance('samoza', 'samosa', 2)).toBe(1);
    expect(editDistance('kitten', 'sitting', 3)).toBe(3);
  });

  it('stops early once it is past the limit', () => {
    expect(editDistance('dal', 'paneer', 1)).toBe(2);
  });
});

describe('typoCorrections', () => {
  const vocabulary = new Map([
    ['biryani', 40],
    ['biriyani', 10],
    ['bhindi', 5],
    ['dal', 100],
  ]);

  it('finds index words a typo or two away, closest and most common first', () => {
    expect(typoCorrections('biryni', vocabulary)).toEqual(['biryani', 'biriyani']);
  });

  it('allows 1 typo up to 5 letters, 2 for longer words', () => {
    expect(allowedTypos('bindi')).toBe(1);
    expect(allowedTypos('bhindii')).toBe(2);
  });

  it('skips words the prefix search already finds, and very short words', () => {
    expect(typoCorrections('bhin', vocabulary)).toEqual([]);
    expect(typoCorrections('da', vocabulary)).toEqual([]);
  });
});
