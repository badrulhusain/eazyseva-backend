import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const mockAuthService = {
  getUserFromAccessToken: jest.fn(),
};

function buildContext(overrides: {
  isPublic?: boolean;
  authorization?: string;
}): ExecutionContext {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockReturnValue(overrides.isPublic ?? false);

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          ...(overrides.authorization
            ? { authorization: overrides.authorization }
            : {}),
        },
        user: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector, mockAuthService as any);
    jest.clearAllMocks();
  });

  describe('public routes', () => {
    it('bypasses auth when @Public() is set', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const ctx = buildContext({ isPublic: true });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockAuthService.getUserFromAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('protected routes', () => {
    it('throws UnauthorizedException when Authorization header is missing', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const ctx = buildContext({});
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when scheme is not bearer', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const ctx = buildContext({ authorization: 'Basic dXNlcjpwYXNz' });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token is missing after "bearer"', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const ctx = buildContext({ authorization: 'Bearer' });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('attaches user to request on valid token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const fakeUser = { id: 'u1', email: 'a@b.com', role: 'USER' };
      mockAuthService.getUserFromAccessToken.mockResolvedValueOnce(fakeUser);

      const req: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      };
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(req.user).toEqual(fakeUser);
      expect(mockAuthService.getUserFromAccessToken).toHaveBeenCalledWith(
        'valid-token',
      );
    });

    it('propagates UnauthorizedException from authService', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockAuthService.getUserFromAccessToken.mockRejectedValueOnce(
        new UnauthorizedException({ code: 'UNAUTHORIZED' }),
      );
      const req: any = {
        headers: { authorization: 'Bearer bad-token' },
        user: undefined,
      };
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
