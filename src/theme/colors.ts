// Colour tokens for light and dark mode (SPEC §8.1).
// The base is monochrome. Accent colours are used only where they carry meaning,
// and none of them is red: being above a target is never shown as an alarm.
// colors.test.ts checks every text and accent token against WCAG AA contrast.

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  // Base (monochrome)
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  iconInactive: string; // also inactive tab labels, so it must pass AA contrast as text
  scrim: string; // dims the screen behind a bottom sheet
  cameraOverlay: string; // dims the camera picture around the barcode frame
  onCamera: string; // text, icons and the frame drawn on top of the camera picture
  // Accents (meaningful only)
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  water: string;
  weight: string;
  onTrack: string;
  offTarget: string;
  notice: string;
  partial: string;
  // Calendar day fills (SPEC §5.6): soft tints behind the day number, which stays in `text`.
  onTargetFill: string;
  nearFill: string; // a bit under or over
  farFill: string; // far off — a deeper blue, never red
  partialFill: string;
};

const light: ColorTokens = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F0F0',
  border: '#E0E0E0',
  text: '#141414',
  textSecondary: '#595959',
  iconInactive: '#6B6B6B',
  scrim: 'rgba(0, 0, 0, 0.4)',
  cameraOverlay: 'rgba(0, 0, 0, 0.5)',
  onCamera: '#FFFFFF',
  protein: '#4F5BD5',
  carbs: '#B07D22',
  fat: '#2A8C82',
  fibre: '#6B7A2E',
  water: '#3A8FD1',
  weight: '#7A4FBF',
  onTrack: '#4E9A6B',
  offTarget: '#5B84C4',
  notice: '#C07A0E',
  partial: '#8F8F8F',
  onTargetFill: '#CDE8D6',
  nearFill: '#DCE6F6',
  farFill: '#B3C8EA',
  partialFill: '#E4E4E4',
};

const dark: ColorTokens = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceMuted: '#242424',
  border: '#2E2E2E',
  text: '#F2F2F2',
  textSecondary: '#A8A8A8',
  iconInactive: '#8F8F8F',
  scrim: 'rgba(0, 0, 0, 0.6)',
  cameraOverlay: 'rgba(0, 0, 0, 0.5)',
  onCamera: '#FFFFFF',
  protein: '#8C95F0',
  carbs: '#D9AE5C',
  fat: '#5CC2B6',
  fibre: '#A3B25E',
  water: '#7CBDEB',
  weight: '#B394E6',
  onTrack: '#7FC79A',
  offTarget: '#8FB0E0',
  notice: '#E3B35A',
  partial: '#6E6E6E',
  onTargetFill: '#27483A',
  nearFill: '#26344A',
  farFill: '#35507A',
  partialFill: '#303030',
};

export const colors: Record<ColorScheme, ColorTokens> = { light, dark };
