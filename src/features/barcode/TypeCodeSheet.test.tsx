import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { TypeCodeSheet } from './TypeCodeSheet';

describe('Type the number', () => {
  it('catches a mistyped digit before looking anything up', async () => {
    const onCode = jest.fn();
    await render(<TypeCodeSheet onClose={() => {}} onCode={onCode} />);

    await fireEvent.changeText(screen.getByLabelText('Barcode number'), '8901058851297');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
    expect(screen.getByText(/doesn't add up — a digit may be mistyped/)).toBeOnTheScreen();
    expect(onCode).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Barcode number'), '8901 0588 51298');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
    expect(onCode).toHaveBeenCalledWith('8901058851298');
  });

  it('says how many digits a barcode has', async () => {
    await render(<TypeCodeSheet onClose={() => {}} onCode={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText('Barcode number'), '12345');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
    expect(screen.getByText('A packet barcode has 8, 12 or 13 digits.')).toBeOnTheScreen();
  });
});
