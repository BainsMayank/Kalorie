import { contrastRatio, luminance } from './contrast';

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1);
  });

  it('refuses anything but #RRGGBB', () => {
    expect(() => luminance('rgba(0, 0, 0, 0.4)')).toThrow();
    expect(() => luminance('#FFF')).toThrow();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('matches the WCAG reference: #767676 on white is just above 4.5', () => {
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });
});
