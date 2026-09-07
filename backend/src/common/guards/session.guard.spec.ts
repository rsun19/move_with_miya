import { UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from './session.guard';

describe('SessionGuard', () => {
  const context = (userId?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ session: userId ? { userId } : {} }),
      }),
    }) as never;

  it('allows an authenticated session', () => {
    expect(new SessionGuard().canActivate(context('user-1'))).toBe(true);
  });

  it('rejects an unauthenticated session', () => {
    expect(() => new SessionGuard().canActivate(context())).toThrow(
      UnauthorizedException,
    );
  });
});
