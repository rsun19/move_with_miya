import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import LoginClient from './LoginClient';

const authMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const searchParamsMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ useAuth: authMock }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: searchParamsMock,
}));

describe('LoginClient', () => {
  it('shows a loading indicator while authentication is resolving', () => {
    authMock.mockReturnValue({ user: null, loading: true, login: vi.fn() });
    searchParamsMock.mockReturnValue(new URLSearchParams());
    render(<LoginClient />);
    expect(
      screen.getByRole('progressbar', { name: 'Loading' }),
    ).toBeInTheDocument();
  });

  it('starts Google login for signed-out users', async () => {
    const user = userEvent.setup();
    const login = vi.fn();
    authMock.mockReturnValue({ user: null, loading: false, login });
    searchParamsMock.mockReturnValue(new URLSearchParams());
    render(<LoginClient />);
    await user.click(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    );
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('redirects authenticated users to the requested destination', () => {
    authMock.mockReturnValue({
      user: { id: 'u1' },
      loading: false,
      login: vi.fn(),
    });
    searchParamsMock.mockReturnValue(new URLSearchParams('next=%2Fclasses'));
    render(<LoginClient />);
    expect(pushMock).toHaveBeenCalledWith('/classes');
  });
});
