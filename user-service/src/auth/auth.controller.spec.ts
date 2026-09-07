import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

jest.mock('uuid', () => ({ v4: jest.fn(() => 'state-id') }));
jest.mock('../users/users.service', () => ({ UsersService: class {} }));

import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    getGoogleAuthURL: jest.fn(),
    exchangeCode: jest.fn(),
    fetchGoogleProfile: jest.fn(),
    findOrCreateUser: jest.fn(),
    getFrontendUrl: jest.fn(),
  };
  const usersService = { findById: jest.fn() };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(
      authService as never,
      usersService as never,
    );
  });

  it('redirects Google login with a saved CSRF state', () => {
    authService.getGoogleAuthURL.mockReturnValue('https://google.test');
    const request = { session: {} } as unknown as Request;
    const redirectMock = jest.fn();
    const response = { redirect: redirectMock } as unknown as Response;
    controller.googleAuth(request, response);
    expect(request.session.state).toEqual(expect.any(String));
    expect(authService.getGoogleAuthURL).toHaveBeenCalledWith(
      request.session.state,
    );
    expect(redirectMock).toHaveBeenCalledWith('https://google.test');
  });

  it('rejects callback state mismatches', async () => {
    const request = { session: { state: 'saved' } } as unknown as Request;
    await expect(
      controller.googleCallback(request, {} as Response, 'code', 'wrong'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('completes a callback and starts a session', async () => {
    authService.exchangeCode.mockResolvedValue({ accessToken: 'token' });
    authService.fetchGoogleProfile.mockResolvedValue({ sub: 'google-1' });
    authService.findOrCreateUser.mockResolvedValue({ id: 'user-1' });
    authService.getFrontendUrl.mockReturnValue('http://frontend.test');
    const request = { session: { state: 'saved' } } as unknown as Request;
    const redirectMock = jest.fn();
    const response = { redirect: redirectMock } as unknown as Response;
    await controller.googleCallback(request, response, 'code', 'saved');
    expect(request.session.userId).toBe('user-1');
    expect(redirectMock).toHaveBeenCalledWith('http://frontend.test');
  });

  it('returns the logged-in user and destroys sessions on logout', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });
    const request = { session: { userId: 'user-1' } } as unknown as Request;
    await expect(controller.me(request)).resolves.toEqual({ id: 'user-1' });

    const logoutRequest = {
      session: { destroy: (callback: () => void) => callback() },
    } as unknown as Request;
    const clearCookieMock = jest.fn();
    const jsonMock = jest.fn();
    const response = {
      clearCookie: clearCookieMock,
      json: jsonMock,
    } as unknown as Response;
    controller.logout(logoutRequest, response);
    expect(clearCookieMock).toHaveBeenCalledWith('connect.sid');
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Logged out' });
  });

  it('rejects /me without a user session', async () => {
    await expect(
      controller.me({ session: {} } as unknown as Request),
    ).rejects.toThrow('Not authenticated');
  });
});
