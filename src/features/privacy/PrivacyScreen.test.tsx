import i18n from '@/i18n';

import { render, screen } from '@testing-library/react-native';

import { PrivacyScreen } from './PrivacyScreen';

describe('Privacy', () => {
  it('says what is stored, where, and that nothing is sold', async () => {
    await render(<PrivacyScreen />);
    expect(screen.getByText('On your phone')).toBeOnTheScreen();
    expect(screen.getByText(/We keep your email address/)).toBeOnTheScreen();
    expect(screen.getByText(/servers in Mumbai, India/)).toBeOnTheScreen();
    expect(screen.getByText(/never sold, never shared with advertisers/)).toBeOnTheScreen();
    expect(screen.getByText(/Delete my account and data/)).toBeOnTheScreen();
    // Stage 11c: what a group sees, and what it never sees.
    expect(screen.getByText('If you join a group')).toBeOnTheScreen();
    expect(screen.getByText(/label photos are never shared/)).toBeOnTheScreen();
    expect(screen.getAllByRole('header')).toHaveLength(7);
  });

  it('is in Hindi too', async () => {
    await i18n.changeLanguage('hi');
    await render(<PrivacyScreen />);
    expect(screen.getByText('कभी बेचा नहीं जाता')).toBeOnTheScreen();
    await screen.unmount();
    await i18n.changeLanguage('en');
  });
});
