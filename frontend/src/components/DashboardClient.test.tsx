import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import DashboardClient from './DashboardClient';
import type { AuthUser } from '@/lib/types';

const logoutMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ logout: logoutMock }) }));

const user: AuthUser = {
  id: 'user-1',
  email: 'person@example.com',
  firstName: 'Move',
  lastName: 'Miya',
  role: 'TEACHER',
  avatarUrl: null,
  preferredName: null,
  phoneNumber: null,
  yogaExperience: null,
};

describe('DashboardClient', () => {
  it('renders the profile and logs out', async () => {
    const testUser = userEvent.setup();
    render(<DashboardClient user={user} />);
    expect(
      screen.getByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Move Miya')).toBeInTheDocument();
    expect(screen.getByText('TEACHER')).toBeInTheDocument();
    await testUser.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
