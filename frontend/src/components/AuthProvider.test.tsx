import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from './test-utils';
import { AuthProvider, useAuth } from '@/lib/auth';

function Consumer() {
  const { user, loading, logout } = useAuth();
  return (
    <div>
      <span>{loading ? 'loading' : (user?.email ?? 'signed out')}</span>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('loads the current user and clears it on logout', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'u1', email: 'person@example.com' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'ok' })));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(await screen.findByText('person@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'logout' }));
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('treats a failed current-user request as signed out', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(await screen.findByText('signed out')).toBeInTheDocument();
  });
});
