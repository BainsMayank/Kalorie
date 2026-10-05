import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { useAccountStore } from '@/stores/account';
import { useGroupStore } from '@/stores/group';

import { GroupScreen } from './GroupScreen';

// user.db: a fresh in-memory database (the screen lists shared foods from it).
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

const family = {
  id: 'group-1',
  name: 'Sharma family',
  inviteCode: 'K7MQ2P',
  members: [
    { userId: 'me', name: 'Mayank' },
    { userId: 'asha', name: 'Asha' },
  ],
  myUserId: 'me',
};

// The store's server actions are replaced; each test sets what they answer.
const refresh = jest.fn(async () => {});
const start = jest.fn();
const join = jest.fn();
const leave = jest.fn();
const newCode = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useAccountStore.setState({ status: 'signedIn', email: 'mayank@mail.com' });
  useGroupStore.setState({ status: 'none', group: null, refresh, start, join, leave, newCode });
});

describe('My group — not in one yet', () => {
  it('asks to sign in first when signed out', async () => {
    useAccountStore.setState({ status: 'signedOut', email: null });
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('asks the server for the group when opened', async () => {
    await render(<GroupScreen />);
    expect(refresh).toHaveBeenCalled();
  });

  it('needs my name, then joins with the code as typed', async () => {
    join.mockResolvedValue({ ok: true, value: null });
    await render(<GroupScreen />);

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'k7m q2p');
    await fireEvent.press(screen.getByRole('button', { name: 'Join group' }));
    expect(screen.getByText('Type your name for the group.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Your name in the group'), ' Mayank ');
    await fireEvent.press(screen.getByRole('button', { name: 'Join group' }));
    expect(join).toHaveBeenCalledWith('K7MQ2P', 'Mayank');
  });

  it('checks the code before asking the server, and shows the server’s answer', async () => {
    join.mockResolvedValue({ ok: false, problem: 'wrongCode' });
    await render(<GroupScreen />);
    await fireEvent.changeText(screen.getByLabelText('Your name in the group'), 'Mayank');

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'K7MQ');
    await fireEvent.press(screen.getByRole('button', { name: 'Join group' }));
    expect(screen.getByText(/An invite code has 6 letters/)).toBeOnTheScreen();
    expect(join).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'ZZZZZZ');
    await fireEvent.press(screen.getByRole('button', { name: 'Join group' }));
    expect(await screen.findByText(/No group has that code/)).toBeOnTheScreen();
  });

  it('starts a group', async () => {
    start.mockResolvedValue({ ok: true, value: null });
    await render(<GroupScreen />);
    await fireEvent.changeText(screen.getByLabelText('Your name in the group'), 'Mayank');
    await fireEvent.press(screen.getByRole('button', { name: 'Start group' }));
    expect(screen.getByText('Type a name for the group.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Group name'), 'Sharma  family');
    await fireEvent.press(screen.getByRole('button', { name: 'Start group' }));
    expect(start).toHaveBeenCalledWith('Sharma family', 'Mayank');
  });
});

describe('My group — in one', () => {
  beforeEach(() => useGroupStore.setState({ status: 'member', group: family }));

  it('shows the code, the people and empty food lists', async () => {
    await render(<GroupScreen />);
    expect(screen.getByRole('header', { name: 'Sharma family' })).toBeOnTheScreen();
    expect(screen.getByTestId('invite-code')).toHaveTextContent('K7M Q2P');
    expect(screen.getByText('Mayank (you)')).toBeOnTheScreen();
    expect(screen.getByText('Asha')).toBeOnTheScreen();
    expect(await screen.findByText(/Open one of your recipes or products/)).toBeOnTheScreen();
  });

  it('sends the code with the phone’s share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }));
    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('K7M Q2P'),
    });
  });

  it('makes a new code', async () => {
    newCode.mockResolvedValue({ ok: true, value: null });
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Make a new code' }));
    expect(newCode).toHaveBeenCalled();
    expect(await screen.findByText(/The old one no longer works/)).toBeOnTheScreen();
  });

  it('leaves only after confirming', async () => {
    leave.mockResolvedValue({ ok: true, value: null });
    await render(<GroupScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Leave group' }));
    expect(screen.getByText(/The foods you shared leave the group/)).toBeOnTheScreen();
    expect(leave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('confirm-leave'));
    expect(leave).toHaveBeenCalled();
  });
});
