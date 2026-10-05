import {
  ICMR_ROWS,
  MICRO_NUTRIENTS,
  icmrActivity,
  icmrGroup,
  icmrRow,
  microRequirements,
  requirement,
  type IcmrGroup,
} from './icmr';

const GROUPS: IcmrGroup[] = ['boy_16_18', 'girl_16_18', 'man', 'woman', 'man_60', 'woman_60'];

describe('ICMR_ROWS', () => {
  it('has no value typed in twice', () => {
    const keys = ICMR_ROWS.map((r) => `${r.group}|${r.nutrient}|${r.kind}|${r.activity ?? '-'}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every value a page from the report’s tables or text (pp. 1–17)', () => {
    for (const r of ICMR_ROWS) {
      expect(r.page).toBeGreaterThanOrEqual(1);
      expect(r.page).toBeLessThanOrEqual(17);
      expect(r.value).toBeGreaterThan(0);
    }
  });

  it('keeps each EAR at or below its RDA', () => {
    for (const ear of ICMR_ROWS.filter((r) => r.kind === 'ear' && r.nutrient !== 'energy_kcal')) {
      const rda = icmrRow(ear.group, ear.nutrient, 'rda', ear.activity);
      expect(rda).not.toBeNull();
      expect(ear.value).toBeLessThanOrEqual(rda!.value);
    }
  });

  it('keeps each need below its upper limit', () => {
    for (const group of GROUPS) {
      for (const nutrient of MICRO_NUTRIENTS) {
        for (const level of ['sedentary', 'moderate', 'heavy'] as const) {
          const need =
            icmrRow(group, nutrient, 'rda', level) ?? icmrRow(group, nutrient, 'ai', level);
          const tul = icmrRow(group, nutrient, 'tul', level);
          if (need && tul && nutrient !== 'magnesium_mg')
            expect(need.value).toBeLessThan(tul.value);
        }
      }
    }
  });
});

describe('icmrGroup', () => {
  it('puts 18-year-olds in 16–18 y, 19–59 in adults and 60+ in elderly', () => {
    expect(icmrGroup(17, 'm')).toBeNull();
    expect(icmrGroup(18, 'f')).toBe('girl_16_18');
    expect(icmrGroup(19, 'm')).toBe('man');
    expect(icmrGroup(59, 'f')).toBe('woman');
    expect(icmrGroup(60, 'm')).toBe('man_60');
  });
});

describe('icmrActivity', () => {
  it('maps the 5 activity levels onto sedentary / moderate / heavy', () => {
    expect(icmrActivity('sedentary')).toBe('sedentary');
    expect(icmrActivity('light')).toBe('sedentary');
    expect(icmrActivity('moderate')).toBe('moderate');
    expect(icmrActivity('active')).toBe('moderate');
    expect(icmrActivity('very_active')).toBe('heavy');
  });
});

describe('requirement', () => {
  it('reads the RDA table (p. 13)', () => {
    expect(requirement('iron_mg', 'f', 30)).toEqual({ need: 29, ear: 15, tul: 45 });
    expect(requirement('iron_mg', 'm', 30)).toEqual({ need: 19, ear: 11, tul: 45 });
  });

  it('uses the category of work where the table splits by it', () => {
    expect(requirement('thiamine_mg', 'm', 30, 'sedentary')?.need).toBe(1.4);
    expect(requirement('thiamine_mg', 'm', 30, 'active')?.need).toBe(1.8);
    expect(requirement('thiamine_mg', 'm', 30, 'very_active')?.need).toBe(2.3);
    expect(requirement('fibre_g', 'f', 30, 'moderate')?.need).toBe(30);
  });

  it('stores vitamin D in µg (600 IU = 15 µg)', () => {
    expect(requirement('vit_d_ug', 'm', 30)).toEqual({ need: 15, ear: 10, tul: 100 });
    expect(requirement('vit_d_ug', 'f', 65)?.need).toBe(20); // 800 IU from 60 y (p. 15)
  });

  it('uses the elderly table from 60 and the adult rows for anything it leaves out', () => {
    expect(requirement('iron_mg', 'f', 65)?.need).toBe(19);
    expect(requirement('calcium_mg', 'm', 65)?.need).toBe(1200);
    expect(requirement('copper_mg', 'm', 65)?.need).toBe(1.7);
    expect(requirement('iron_mg', 'f', 65)?.tul).toBe(45);
  });

  it('uses the 16–18 y rows for an 18-year-old', () => {
    expect(requirement('iron_mg', 'f', 18)).toEqual({ need: 32, ear: 18, tul: 45 });
    expect(requirement('biotin_ug', 'm', 18)?.need).toBe(35);
    expect(requirement('vit_k_ug', 'm', 18)?.need).toBe(55); // adult value
  });

  it('takes the higher need and the lower limit for "prefer not to say"', () => {
    expect(requirement('iron_mg', 'x', 30)).toEqual({ need: 29, ear: 15, tul: 45 });
    expect(requirement('vit_c_mg', 'x', 30)?.need).toBe(80);
    expect(requirement('vit_c_mg', 'x', 18)?.tul).toBe(1950);
  });

  it('has no requirement under 18', () => {
    expect(requirement('iron_mg', 'f', 17)).toBeNull();
    expect(microRequirements('m', 16)).toBeNull();
  });
});

describe('microRequirements', () => {
  it('covers every vitamin and mineral for every adult group', () => {
    for (const [sex, age] of [
      ['m', 18],
      ['f', 18],
      ['m', 30],
      ['f', 30],
      ['m', 70],
      ['f', 70],
      ['x', 40],
    ] as const) {
      const reqs = microRequirements(sex, age)!;
      for (const nutrient of MICRO_NUTRIENTS) {
        if (nutrient === 'sodium_mg') expect(reqs[nutrient]?.tul).toBe(2000);
        else expect(reqs[nutrient]?.need).toBeGreaterThan(0);
      }
    }
  });
});
