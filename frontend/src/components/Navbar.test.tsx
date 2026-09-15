import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import Navbar from './Navbar';

const useAuthMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ useAuth: useAuthMock }));

describe('Navbar', () => {
  it('shows public navigation and sign-in for signed-out visitors', () => {
    useAuthMock.mockReturnValue({ user: null, logout: vi.fn() });
    render(<Navbar />);
    expect(
      screen.getAllByRole('link', { name: 'Classes' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Contact' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('shows staff actions and signs out an admin', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    useAuthMock.mockReturnValue({
      user: { id: 'admin-1', firstName: 'A', lastName: 'Admin', role: 'ADMIN' },
      logout,
    });
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin',
    );
    await user.click(screen.getAllByRole('button', { name: 'Sign Out' })[0]);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('opens mobile navigation links', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({ user: null, logout: vi.fn() });
    render(<Navbar />);
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(
      screen.getAllByRole('link', { name: 'Sign In' }).length,
    ).toBeGreaterThan(0);
  });
});
