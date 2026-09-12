import { AuthService } from './auth.service';

jest.mock('../users/users.service', () => ({ UsersService: class {} }));

describe('AuthService', () => {
  const profile = {
    sub: 'google-1',
    email: 'person@example.com',
    given_name: 'Move',
    family_name: 'Miya',
    picture: 'https://example.com/avatar.jpg',
  };

  it('builds a Google authorization URL with the CSRF state', () => {
    const config = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CALLBACK_URL: 'http://localhost:5173/callback',
    };
    const configService = {
      get: jest.fn((key: string) => config[key as keyof typeof config]),
    };
    const service = new AuthService({} as never, configService as never);

    const url = new URL(service.getGoogleAuthURL('state-1'));

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/callback',
    );
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
  });

  it('requires OAuth configuration', () => {
    const configService = { get: jest.fn(() => undefined) };
    const service = new AuthService({} as never, configService as never);

    expect(() => service.getGoogleAuthURL('state-1')).toThrow(
      'GOOGLE_CLIENT_ID is not configured',
    );
  });

  it('updates the last login for an existing Google user', async () => {
    const existing = { id: 'user-1' };
    const usersService = {
      findByGoogleId: jest.fn().mockResolvedValue(existing),
      updateLastLogin: jest
        .fn()
        .mockResolvedValue({ ...existing, lastLoginAt: new Date() }),
      create: jest.fn(),
    };
    const service = new AuthService(usersService as never, {} as never);

    await expect(service.findOrCreateUser(profile)).resolves.toMatchObject({
      id: 'user-1',
    });
    expect(usersService.updateLastLogin).toHaveBeenCalledWith('user-1');
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('creates a user from a new Google profile', async () => {
    const usersService = {
      findByGoogleId: jest.fn().mockResolvedValue(null),
      updateLastLogin: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const service = new AuthService(usersService as never, {} as never);

    await expect(service.findOrCreateUser(profile)).resolves.toEqual({
      id: 'user-1',
    });
    expect(usersService.create).toHaveBeenCalledWith({
      googleId: 'google-1',
      email: 'person@example.com',
      firstName: 'Move',
      lastName: 'Miya',
      avatarUrl: 'https://example.com/avatar.jpg',
    });
  });
});
