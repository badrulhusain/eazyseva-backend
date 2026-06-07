import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { CurrentUser } from '../../common/types/current-user.type';

function buildContext(user?: CurrentUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('allows access when user.role is ADMIN', () => {
    const ctx = buildContext({
      id: 'a1',
      email: 'admin@x.com',
      role: 'ADMIN',
      full_name: null,
      phone: null,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException with ADMIN_ONLY code when user.role is USER', () => {
    const ctx = buildContext({
      id: 'u1',
      email: 'user@x.com',
      role: 'USER',
      full_name: null,
      phone: null,
    });
    try {
      guard.canActivate(ctx);
      fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toEqual({
        code: 'ADMIN_ONLY',
        message: 'Admin access required',
      });
    }
  });

  it('throws ForbiddenException when request.user is missing', () => {
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
