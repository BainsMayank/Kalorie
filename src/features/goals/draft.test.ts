import { answersFromDraft, bodyFromDraft, draftFromProfile, EMPTY_DRAFT, isUnder18 } from './draft';

const NOW = new Date(2026, 8, 27).getTime();

describe('answersFromDraft', () => {
  it('turns typed text into saved answers', () => {
    const { answers, weightKg } = answersFromDraft(
      {
        ...EMPTY_DRAFT,
        sex: 'f',
        age: '28',
        heightCm: 160,
        weight: '60.5',
        goal: 'lose',
        pace: 0.5,
      },
      NOW,
    );
    expect(answers).toEqual({
      sex: 'f',
      birthYear: 1998,
      heightCm: 160,
      activity: null,
      goal: 'lose',
      paceKgWeek: 0.5,
    });
    expect(weightKg).toBe(60.5);
  });

  it('leaves skipped or unbelievable answers empty', () => {
    const { answers, weightKg } = answersFromDraft(
      { ...EMPTY_DRAFT, age: '250', weight: 'abc' },
      NOW,
    );
    expect(answers.birthYear).toBeNull();
    expect(answers.goal).toBeNull();
    expect(answers.paceKgWeek).toBeNull();
    expect(weightKg).toBeNull();
  });

  it('switches under-18s to Just track', () => {
    const draft = { ...EMPTY_DRAFT, age: '16', goal: 'lose' as const, pace: 0.5 };
    expect(isUnder18(draft)).toBe(true);
    expect(answersFromDraft(draft, NOW).answers).toMatchObject({ goal: 'track', paceKgWeek: 0 });
  });

  it('gives gain its only pace and lose the gentle one by default', () => {
    expect(
      answersFromDraft({ ...EMPTY_DRAFT, goal: 'gain', pace: 0.5 }, NOW).answers.paceKgWeek,
    ).toBe(0.25);
    expect(answersFromDraft({ ...EMPTY_DRAFT, goal: 'lose' }, NOW).answers.paceKgWeek).toBe(0.25);
  });
});

describe('draftFromProfile', () => {
  it('goes back to the same draft after saving', () => {
    const draft = {
      ...EMPTY_DRAFT,
      sex: 'm' as const,
      age: '30',
      heightCm: 175,
      weight: '70',
      activity: 'moderate' as const,
      goal: 'maintain' as const,
      pace: 0,
    };
    const { answers, weightKg } = answersFromDraft(draft, NOW);
    const profile = { id: 1, ...answers, onboardedAt: NOW, updatedAt: NOW };
    expect(draftFromProfile(profile, weightKg, NOW)).toEqual(draft);
    expect(bodyFromDraft(draft, NOW)).toMatchObject({ age: 30, weightKg: 70, heightCm: 175 });
  });
});
