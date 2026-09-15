import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import ProfileForm from './ProfileForm';
import type { AuthUser } from '@/lib/types';

const user: AuthUser = {
  id: 'user-1',
  email: 'person@example.com',
  firstName: 'Move',
  lastName: 'Miya',
  role: 'MEMBER',
  preferredName: null,
  phoneNumber: null,
  yogaExperience: null,
};

afterEach(() => vi.restoreAllMocks());

describe('ProfileForm', () => {
  it('rejects blank required names without calling the API', async () => {
    const testUser = userEvent.setup();
    const fetchMock = vi.spyOn(global, 'fetch');
    render(<ProfileForm user={{ ...user, firstName: '' }} />);

    await testUser.clear(screen.getByLabelText(/^First name/));
    await testUser.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(
      screen.getByText('First name and last name are required.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('saves profile fields and reports success', async () => {
    const testUser = userEvent.setup();
    const updated = { ...user, preferredName: 'Mia', phoneNumber: '555-0100' };
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(updated), { status: 200 }),
      );
    const onSaved = vi.fn();
    render(<ProfileForm user={user} onSaved={onSaved} />);

    await testUser.type(screen.getByLabelText(/^Preferred name/), 'Mia');
    await testUser.type(screen.getByLabelText(/^Phone number/), '555-0100');
    await testUser.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/user-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          firstName: 'Move',
          lastName: 'Miya',
          preferredName: 'Mia',
          phoneNumber: '555-0100',
          yogaExperience: null,
        }),
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it('shows save failures', async () => {
    const testUser = userEvent.setup();
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Profile locked' }), {
        status: 403,
      }),
    );
    render(<ProfileForm user={user} />);

    await testUser.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile locked')).toBeInTheDocument();
  });
});
