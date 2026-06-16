import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@supabase/supabase-js';
import { createPublicKey, type JsonWebKey } from 'crypto';
import type { Algorithm, Jwt } from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/types/current-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

type SupabaseAccessTokenPayload = {
  sub?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type JwksKey = JsonWebKey & {
  kid?: string;
  alg?: string;
};

type JwksResponse = {
  keys?: JwksKey[];
};

const JWKS_CACHE_TTL_MS = 10 * 60_000;
const JWKS_FETCH_TIMEOUT_MS = 5_000;
const ASYMMETRIC_JWT_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
] as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwksCache: { keys: JwksKey[]; expiresAt: number } | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── In-process token cache ─────────────────────────────────────────────────
  //
  // Trade-off: we cache auth+profile data for up to TOKEN_CACHE_TTL ms so that
  // repeated authenticated requests within the same TTL window make zero Supabase
  // network calls. The downside is that a banned or role-changed user can make
  // requests for up to TOKEN_CACHE_TTL ms after the change.
  //
  // TOKEN_CACHE_TTL = 60 s is short enough that the blast radius of a stale cache
  // entry is acceptable for a prototype. In production, consider 15–30 s and/or
  // a Redis-backed cache with pub/sub invalidation on role changes.
  //
  // MAX cache size prevents unbounded growth on high-traffic deployments. When the
  // cache is full we evict expired entries first; if none are expired we evict the
  // oldest (FIFO) to stay bounded.

  private readonly tokenCache = new Map<
    string,
    { user: CurrentUser; expiresAt: number }
  >();
  private readonly TOKEN_CACHE_TTL = 60_000; // 60 seconds
  private readonly TOKEN_CACHE_MAX = 500;

  // ── Public auth methods ────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const { data, error } =
      await this.supabaseService.admin.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          full_name: dto.full_name,
          phone: dto.phone,
        },
      });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('already') ||
        (msg.includes('email') && msg.includes('registered'))
      ) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Email is already registered',
        });
      }
      this.logger.error(
        `Registration failed for ${dto.email}: ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'REGISTER_FAILED',
        message: error.message,
      });
    }

    this.logger.log(`User registered: ${data.user.id}`);

    const { error: profileError } = await this.supabaseService.admin
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          email: data.user.email,
          full_name: dto.full_name,
          phone: dto.phone,
          role: 'USER',
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      throw new InternalServerErrorException({
        code: 'PROFILE_CREATE_FAILED',
        message: profileError.message,
      });
    }

    return {
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
        full_name: dto.full_name,
        phone: dto.phone,
      },
    };
  }

  async login(dto: LoginDto) {
    const { data, error } =
      await this.supabaseService.supabase.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const user = await this.resolveCurrentUser(data.user);

    return {
      success: true,
      data: {
        user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
      },
    };
  }

  getMe(user: CurrentUser) {
    return { success: true, data: user };
  }

  /**
   * Resolves a CurrentUser from a bearer token.
   *
   * Fast path: cache hit -> zero work (valid for TOKEN_CACHE_TTL ms).
   * Slow path: validate token locally, fetch profile from DB, then cache.
   * Local verification keeps session restore independent from Supabase Auth
   * network latency, which otherwise can make the frontend's restore request
   * hit its 15-second timeout.
   */
  async getUserFromAccessToken(token: string): Promise<CurrentUser> {
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    try {
      const payload = await this.verifySupabaseAccessToken(token);

      if (!payload.sub) {
        this.tokenCache.delete(token);
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Login required',
        });
      }

      const user = await this.resolveCurrentUser({
        id: payload.sub,
        email: payload.email,
        user_metadata: payload.user_metadata ?? {},
      });
      this.cacheToken(token, user);
      return user;
    } catch (error) {
      this.tokenCache.delete(token);
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Login required',
      });
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private async verifySupabaseAccessToken(
    token: string,
  ): Promise<SupabaseAccessTokenPayload> {
    const decoded = this.jwtService.decode(token, {
      complete: true,
    }) as Jwt | null;

    if (!decoded || typeof decoded.payload === 'string') {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Login required',
      });
    }

    const alg = decoded.header.alg;

    if (alg === 'HS256') {
      return this.jwtService.verifyAsync<SupabaseAccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('SUPABASE_JWT_SECRET'),
        algorithms: ['HS256'],
      });
    }

    if (!this.isSupportedAsymmetricAlgorithm(alg) || !decoded.header.kid) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Login required',
      });
    }

    const key = await this.getJwksKey(decoded.header.kid, alg);
    const publicKey = createPublicKey({
      key: key as JsonWebKey,
      format: 'jwk',
    }).export({ format: 'pem', type: 'spki' });

    return this.jwtService.verifyAsync<SupabaseAccessTokenPayload>(token, {
      secret: publicKey,
      algorithms: [alg],
    });
  }

  private isSupportedAsymmetricAlgorithm(
    alg: string,
  ): alg is (typeof ASYMMETRIC_JWT_ALGORITHMS)[number] {
    return ASYMMETRIC_JWT_ALGORITHMS.includes(
      alg as (typeof ASYMMETRIC_JWT_ALGORITHMS)[number],
    );
  }

  private async getJwksKey(kid: string, alg: Algorithm): Promise<JwksKey> {
    const keys = await this.getJwksKeys();
    const key = keys.find((candidate) => candidate.kid === kid);

    if (!key || (key.alg && key.alg !== alg)) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Login required',
      });
    }

    return key;
  }

  private async getJwksKeys(): Promise<JwksKey[]> {
    if (this.jwksCache && this.jwksCache.expiresAt > Date.now()) {
      return this.jwksCache.keys;
    }

    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const jwksUrl = new URL(
      '/auth/v1/.well-known/jwks.json',
      supabaseUrl,
    ).toString();

    const response = await fetch(jwksUrl, {
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Login required',
      });
    }

    const data = (await response.json()) as JwksResponse;
    const keys = Array.isArray(data.keys) ? data.keys : [];
    this.jwksCache = {
      keys,
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    };

    return keys;
  }

  private cacheToken(token: string, user: CurrentUser): void {
    if (this.tokenCache.size >= this.TOKEN_CACHE_MAX) {
      const now = Date.now();
      let evictedExpired = false;
      for (const [k, v] of this.tokenCache) {
        if (v.expiresAt <= now) {
          this.tokenCache.delete(k);
          evictedExpired = true;
        }
      }
      // If no expired entries exist, evict the oldest (FIFO) to keep cache bounded.
      if (!evictedExpired) {
        const oldest = this.tokenCache.keys().next().value;
        if (oldest !== undefined) this.tokenCache.delete(oldest);
      }
    }
    this.tokenCache.set(token, {
      user,
      expiresAt: Date.now() + this.TOKEN_CACHE_TTL,
    });
  }

  /**
   * Fetches the canonical user profile from the profiles table.
   *
   * All role and identity data comes from the DB, not from the JWT, so an
   * admin revocation or role downgrade takes effect within TOKEN_CACHE_TTL ms.
   *
   * Falls back to user_metadata if the profile row does not yet exist and
   * auto-creates the missing profile row.
   */
  async resolveCurrentUser(
    user: Pick<User, 'id' | 'email' | 'user_metadata'>,
  ): Promise<CurrentUser> {
    const { data: profile, error } = await this.supabaseService.admin
      .from('profiles')
      .select('id, email, role, full_name, phone')
      .eq('id', user.id)
      .single();

    if (profile) {
      return {
        id: profile.id as string,
        email: profile.email as string,
        role: profile.role as 'USER' | 'ADMIN',
        full_name: (profile.full_name as string) ?? null,
        phone: (profile.phone as string) ?? null,
      };
    }

    if (error?.code !== 'PGRST116') {
      throw new UnauthorizedException({
        code: 'PROFILE_LOOKUP_FAILED',
        message: error?.message ?? 'Unable to load user profile',
      });
    }

    // Profile row not found — upsert a default USER profile and continue.
    const fallbackUser: CurrentUser = {
      id: user.id,
      email: user.email ?? '',
      role: 'USER',
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      phone: (user.user_metadata?.phone as string | undefined) ?? null,
    };

    const { error: upsertError } = await this.supabaseService.admin
      .from('profiles')
      .upsert(
        {
          id: fallbackUser.id,
          email: fallbackUser.email,
          role: fallbackUser.role,
          full_name: fallbackUser.full_name,
          phone: fallbackUser.phone,
        },
        { onConflict: 'id' },
      );

    if (upsertError) {
      this.logger.error(
        `Failed to repair missing profile for user=${fallbackUser.id}: ${upsertError.message}`,
      );
      throw new UnauthorizedException({
        code: 'PROFILE_LOOKUP_FAILED',
        message: 'Unable to load user profile',
      });
    }

    return fallbackUser;
  }
}
