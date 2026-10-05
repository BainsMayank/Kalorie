import { watchAccount } from '@/db/cloud/auth';
import { getSupabase } from '@/db/cloud/client';

import { useAccountStore } from './account';

jest.mock('@/db/cloud/client', () => ({ getSupabase: jest.fn(() => null) }));
jest.mock('@/db/cloud/auth', () => ({ watchAccount: jest.fn(() => () => {}) }));

beforeEach(() => useAccountStore.setState({ status: 'loading', email: null }));

describe('account store', () => {
  it('stays out of the way when this copy of the app has no Supabase project', () => {
    useAccountStore.getState().start();
    expect(useAccountStore.getState().status).toBe('notSetUp');
    expect(watchAccount).not.toHaveBeenCalled();
  });

  it('follows sign-ins and sign-outs', () => {
    jest.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    const stop = jest.fn();
    jest.mocked(watchAccount).mockReturnValue(stop);

    const unsubscribe = useAccountStore.getState().start();
    const onChange = jest.mocked(watchAccount).mock.calls[0][0];

    onChange('asha@mail.com');
    expect(useAccountStore.getState()).toMatchObject({
      status: 'signedIn',
      email: 'asha@mail.com',
    });
    onChange(null);
    expect(useAccountStore.getState()).toMatchObject({ status: 'signedOut', email: null });

    unsubscribe();
    expect(stop).toHaveBeenCalled();
  });
});
