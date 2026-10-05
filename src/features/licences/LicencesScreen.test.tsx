import i18n from '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { LicencesScreen } from './LicencesScreen';

jest.mock('./licences.json', () => ({
  packages: [
    { name: 'drizzle-orm', version: '0.45.3', license: 'Apache-2.0', text: null },
    { name: 'zustand', version: '5.0.15', license: 'MIT', text: 0 },
  ],
  texts: ['MIT License\n\nCopyright (c) 2019 Paul Henschel'],
}));

describe('Open-source licences', () => {
  it('lists each library with its version and licence', async () => {
    await render(<LicencesScreen />);
    expect(screen.getByText(/built with 2 open-source libraries/)).toBeOnTheScreen();
    expect(screen.getByText('zustand')).toBeOnTheScreen();
    expect(screen.getByText('5.0.15 · MIT')).toBeOnTheScreen();
  });

  it('shows the licence text on tap, and hides it on a second tap', async () => {
    await render(<LicencesScreen />);
    expect(screen.queryByText(/Paul Henschel/)).toBeNull();
    await fireEvent.press(screen.getByText('zustand'));
    expect(screen.getByText(/Copyright \(c\) 2019 Paul Henschel/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('zustand'));
    expect(screen.queryByText(/Paul Henschel/)).toBeNull();
  });

  it('links to npm when a library ships no licence file', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(<LicencesScreen />);
    await fireEvent.press(screen.getByText('drizzle-orm'));
    await fireEvent.press(screen.getByText('Read the licence on npm'));
    expect(open).toHaveBeenCalledWith('https://www.npmjs.com/package/drizzle-orm/v/0.45.3');
  });

  it('is in Hindi too', async () => {
    await i18n.changeLanguage('hi');
    await render(<LicencesScreen />);
    expect(screen.getByText(/2 ओपन-सोर्स लाइब्रेरी/)).toBeOnTheScreen();
    await screen.unmount();
    await i18n.changeLanguage('en');
  });
});
