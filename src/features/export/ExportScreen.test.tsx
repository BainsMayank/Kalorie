import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ExportScreen } from './ExportScreen';
import { shareExportFile } from './share';

jest.mock('./share', () => ({ shareExportFile: jest.fn(async () => {}) }));
jest.mock('@/db/user/export', () => ({ firstRecordedDay: jest.fn(async () => '2026-03-15') }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true) }));

const NOW = new Date(2026, 8, 28, 12).getTime(); // Mon 28 Sep 2026, noon

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  jest.mocked(shareExportFile).mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function renderExport() {
  await render(<ExportScreen />);
  await act(async () => {}); // the first recorded day and share check
}

describe('Export CSV', () => {
  it('shares one file for the last 30 days by default', async () => {
    await renderExport();
    expect(screen.getByText('Sun, 30 Aug – Mon, 28 Sep')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Share Daily totals' }));

    expect(shareExportFile).toHaveBeenCalledWith(
      expect.any(Function),
      'daily',
      '2026-08-30',
      '2026-09-28',
    );
  });

  it('exports everything from the first recorded day', async () => {
    await renderExport();
    await fireEvent.press(screen.getByRole('radio', { name: 'Everything' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Share Weight' }));

    expect(shareExportFile).toHaveBeenCalledWith(
      expect.any(Function),
      'weight',
      '2026-03-15',
      '2026-09-28',
    );
  });

  it('says so, calmly, when a file could not be made', async () => {
    jest.mocked(shareExportFile).mockRejectedValueOnce(new Error('disk full'));
    await renderExport();

    await fireEvent.press(screen.getByRole('button', { name: 'Share Water' }));

    expect(
      await screen.findByText("The file couldn't be made. Please try again."),
    ).toBeOnTheScreen();
  });

  it('lets you pick your own first and last day', async () => {
    await renderExport();
    await fireEvent.press(screen.getByRole('radio', { name: 'Pick dates' }));

    expect(screen.getByRole('button', { name: 'From, Tue, 22 Sep' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'To, Mon, 28 Sep' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Share Everything you logged' }));
    expect(shareExportFile).toHaveBeenCalledWith(
      expect.any(Function),
      'entries',
      '2026-09-22',
      '2026-09-28',
    );
  });
});
