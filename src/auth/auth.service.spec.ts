import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { AuthService } from './auth.service';

const jwtSecret = 'test-jwt-secret';
const supabaseUrl = 'https://project-ref.supabase.co';

function createService(
  options: {
    alg?: string;
    payload?: Record<string, unknown>;
    verifyError?: Error;
    profile?: Record<string, unknown> | null;
    profileError?: Record<string, unknown> | null;
    upsertError?: Record<string, unknown> | null;
  } = {},
) {
  const single = jest.fn().mockResolvedValue({
    data: options.profile ?? null,
    error: options.profileError ?? null,
  });
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const upsert = jest.fn().mockResolvedValue({
    error: options.upsertError ?? null,
  });
  const from = jest.fn().mockReturnValue({ select, upsert });

  const supabaseService = {
    admin: { from },
    supabase: {
      auth: {
        getUser: jest.fn(),
      },
    },
  };
  const jwtService = {
    decode: jest.fn().mockReturnValue({
      header: { alg: options.alg ?? 'HS256' },
      payload: {},
    }),
    verifyAsync: jest.fn().mockImplementation(async () => {
      if (options.verifyError) throw options.verifyError;
      return (
        options.payload ?? {
          sub: 'user-1',
          email: 'user@example.com',
          user_metadata: { full_name: 'User One', phone: '9999999999' },
        }
      );
    }),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) =>
      key === 'SUPABASE_URL' ? supabaseUrl : jwtSecret,
    ),
  };

  return {
    service: new AuthService(
      supabaseService as any,
      jwtService as any,
      configService as any,
    ),
    supabaseService,
    jwtService,
    configService,
    from,
    select,
    eq,
    single,
    upsert,
  };
}

describe('AuthService', () => {
  describe('getUserFromAccessToken', () => {
    it('verifies JWT locally and resolves the profile without Supabase Auth network call', async () => {
      const { service, supabaseService, jwtService, configService } =
        createService({
          profile: {
            id: 'user-1',
            email: 'user@example.com',
            role: 'USER',
            full_name: 'User One',
            phone: '9999999999',
          },
        });

      await expect(service.getUserFromAccessToken('token-1')).resolves.toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        full_name: 'User One',
        phone: '9999999999',
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-1', {
        secret: jwtSecret,
        algorithms: ['HS256'],
      });
      expect(jwtService.decode).toHaveBeenCalledWith('token-1', {
        complete: true,
      });
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'SUPABASE_JWT_SECRET',
      );
      expect(supabaseService.supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it('rejects invalid JWTs before profile lookup', async () => {
      const { service, from } = createService({
        verifyError: new Error('bad token'),
      });

      await expect(
        service.getUserFromAccessToken('bad-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(from).not.toHaveBeenCalled();
    });

    it('rejects JWTs without a subject claim', async () => {
      const { service, from } = createService({
        payload: { email: 'user@example.com' },
      });

      await expect(
        service.getUserFromAccessToken('missing-sub'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(from).not.toHaveBeenCalled();
    });

    it('verifies asymmetric JWTs with the Supabase JWKS endpoint', async () => {
      const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const jwk = publicKey.export({ format: 'jwk' });
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          keys: [{ ...jwk, kid: 'key-1', alg: 'RS256' }],
        }),
      } as Response);
      const { service, jwtService } = createService({
        alg: 'RS256',
        profile: {
          id: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          full_name: 'User One',
          phone: '9999999999',
        },
      });
      jwtService.decode.mockReturnValueOnce({
        header: { alg: 'RS256', kid: 'key-1' },
        payload: {},
      });

      await expect(service.getUserFromAccessToken('rs-token')).resolves.toEqual(
        {
          id: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          full_name: 'User One',
          phone: '9999999999',
        },
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'rs-token',
        expect.objectContaining({ algorithms: ['RS256'] }),
      );
      fetchSpy.mockRestore();
    });
  });

  describe('resolveCurrentUser', () => {
    it('repairs a missing profile and returns the repaired user', async () => {
      const { service, upsert } = createService({
        profileError: { code: 'PGRST116', message: 'No rows' },
      });

      await expect(
        service.resolveCurrentUser({
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: { full_name: 'User One', phone: '9999999999' },
        } as any),
      ).resolves.toEqual({
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        full_name: 'User One',
        phone: '9999999999',
      });
      expect(upsert).toHaveBeenCalledWith(
        {
          id: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          full_name: 'User One',
          phone: '9999999999',
        },
        { onConflict: 'id' },
      );
    });

    it('does not return a fake fallback profile when profile repair fails', async () => {
      const { service } = createService({
        profileError: { code: 'PGRST116', message: 'No rows' },
        upsertError: { message: 'permission denied' },
      });

      await expect(
        service.resolveCurrentUser({
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: {},
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
