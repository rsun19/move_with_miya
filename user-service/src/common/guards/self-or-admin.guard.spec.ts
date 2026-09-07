import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
jest.mock('../../users/users.service', () => ({ UsersService: class {} }));
import { SelfOrAdminGuard } from './self-or-admin.guard';

describe('SelfOrAdminGuard', () => {
  const executionContext = (sessionUserId: string | undefined, id: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          session: { userId: sessionUserId },
          params: { id },
        }),
      }),
    }) as never;

  it('rejects unauthenticated requests', async () => {
    const service = { findById: jest.fn() };
    const guard = new SelfOrAdminGuard(service as never);

    await expect(
      guard.canActivate(executionContext(undefined, 'user-1')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('allows an active user to update themselves', async () => {
    const service = {
      findById: jest.fn().mockResolvedValue({ id: 'user-1', banned: false }),
    };
    const guard = new SelfOrAdminGuard(service as never);

    await expect(
      guard.canActivate(executionContext('user-1', 'user-1')),
    ).resolves.toBe(true);
  });

  it('allows an admin to update another user', async () => {
    const service = {
      findById: jest.fn().mockResolvedValue({
        id: 'admin-1',
        banned: false,
        role: 'ADMIN',
      }),
    };
    const guard = new SelfOrAdminGuard(service as never);

    await expect(
      guard.canActivate(executionContext('admin-1', 'user-1')),
    ).resolves.toBe(true);
  });

  it('rejects a non-admin updating another user', async () => {
    const service = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        banned: false,
        role: 'MEMBER',
      }),
    };
    const guard = new SelfOrAdminGuard(service as never);

    await expect(
      guard.canActivate(executionContext('user-1', 'user-2')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects banned users even when updating themselves', async () => {
    const service = {
      findById: jest.fn().mockResolvedValue({ id: 'user-1', banned: true }),
    };
    const guard = new SelfOrAdminGuard(service as never);

    await expect(
      guard.canActivate(executionContext('user-1', 'user-1')),
    ).rejects.toThrow('User is banned');
  });
});
