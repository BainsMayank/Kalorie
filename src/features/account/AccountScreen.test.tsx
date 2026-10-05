import '@/i18n';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { deleteAccount, sendSignInCode, signOut, verifySignInCode } from '@/db/cloud/auth';
import { useAccountStore } from '@/stores/account';

import { AccountScreen } from './AccountScreen';

// The server calls are replaced: each test says what the server answers. A successful sign-in,
// sign-out or delete also moves the account store, as Supabase's listener would.
jest.mock('@/db/cloud/auth', () => ({
  sendSignInCode: jest.fn(async () => ({ ok: true })),
  verifySignInCode: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const signedIn = (email: string) => useAccountStore.setState({ status: 'signedIn', email });
const signedOut = () => useAccountStore.setState({ status: 'signedOut', email: null });

beforeEach(() => {
  jest.clearAllMocks();
  signedOut();
});

describe('Account — signing in', () => {
  it('says an account is optional', async () => {
    await render(<AccountScreen />);
    expect(screen.getByText(/An account is optional/)).toBeOnTheScreen();
  });

  it('checks the email before sending anything', async () => {
    await render(<AccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    expect(screen.getByText('Type your email address.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@mail');
    await fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    expect(screen.getByText(/doesn't look like an email address/)).toBeOnTheScreen();
    expect(sendSignInCode).not.toHaveBeenCalled();
  });

  it('sends a code, turns down a wrong one, and signs in with the right one', async () => {
    jest
      .mocked(verifySignInCode)
      .mockResolvedValueOnce({ ok: false, problem: 'wrongCode' })
      .mockImplementationOnce(async () => {
        signedIn('asha@mail.com');
        return { ok: true };
      });
    await render(<AccountScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), ' Asha@Mail.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    expect(sendSignInCode).toHaveBeenCalledWith('asha@mail.com');
    expect(await screen.findByText(/We sent a code to asha@mail.com/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '123');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText(/at least 6 digits/)).toBeOnTheScreen();
    expect(verifySignInCode).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '111 111');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(verifySignInCode).toHaveBeenCalledWith('asha@mail.com', '111111');
    expect(await screen.findByText(/That code didn't work/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Code from the email'), '654321');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('account-email')).toHaveTextContent('asha@mail.com');
  });

  it('sends a new code, or goes back to change the email', async () => {
    await render(<AccountScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@mail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Send a new code' }));
    expect(sendSignInCode).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('A new code is on its way.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('asha@mail.com');
  });

  it('says so when there is no internet', async () => {
    jest.mocked(sendSignInCode).mockResolvedValueOnce({ ok: false, problem: 'offline' });
    await render(<AccountScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'asha@mail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    expect(await screen.findByText(/Couldn't reach the server/)).toBeOnTheScreen();
  });

  it('opens the privacy note', async () => {
    await render(<AccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'What we store, and where' }));
    expect(mockPush).toHaveBeenCalledWith('/privacy');
  });

  it('explains when accounts are not set up in this copy of the app', async () => {
    useAccountStore.setState({ status: 'notSetUp', email: null });
    await render(<AccountScreen />);
    expect(screen.getByText(/Accounts aren't switched on/)).toBeOnTheScreen();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});

describe('Account — signed in', () => {
  beforeEach(() => signedIn('asha@mail.com'));

  it('signs out and says the log is still on the phone', async () => {
    jest.mocked(signOut).mockImplementationOnce(async () => {
      signedOut();
      return { ok: true };
    });
    await render(<AccountScreen />);
    expect(screen.getByTestId('account-email')).toHaveTextContent('asha@mail.com');

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText(/Signed out. Everything you logged/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('asha@mail.com');
  });

  it('deletes the account only after asking', async () => {
    jest.mocked(deleteAccount).mockImplementationOnce(async () => {
      signedOut();
      return { ok: true };
    });
    await render(<AccountScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account and data' }));
    expect(screen.getByText('Delete your account?')).toBeOnTheScreen();
    expect(screen.getByText(/What is on this phone stays/)).toBeOnTheScreen();
    expect(deleteAccount).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('confirm-delete'));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Your account and everything kept online/)).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Delete your account?')).toBeNull());
  });

  it('keeps the account when "Keep my account" is tapped', async () => {
    await render(<AccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account and data' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByText('Delete your account?')).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('keeps the sheet open with the reason when deleting does not go through', async () => {
    jest.mocked(deleteAccount).mockResolvedValueOnce({ ok: false, problem: 'offline' });
    await render(<AccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account and data' }));
    await fireEvent.press(screen.getByTestId('confirm-delete'));

    expect((await screen.findAllByText(/Couldn't reach the server/)).length).toBeGreaterThan(0);
    expect(screen.getByText('Delete your account?')).toBeOnTheScreen();
    expect(screen.getByTestId('account-email')).toHaveTextContent('asha@mail.com');
  });
});
