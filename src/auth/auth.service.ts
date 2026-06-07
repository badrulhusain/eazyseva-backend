import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/types/current-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

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
   * Fast path: cache hit → zero network calls (valid for TOKEN_CACHE_TTL ms).
   * Slow path: validate token via Supabase Auth (1 RTT), then fetch profile
   *            from DB (1 RTT), then cache the result.
   *
   * Why supabase.auth.getUser() instead of local JWT.verify()?
   * JwtModule.register({ secret }) reads process.env at module decoration time,
   * which can be undefined in some NestJS bootstrap sequences before ConfigModule
   * fully initialises, causing every verify() call to throw and returning 401 for
   * all authenticated requests. supabase.auth.getUser() is a network call but is
   * always correct. The cache already eliminates the RTT for 99% of requests
   * (those within the 60 s window). Local verification can be revisited once we
   * switch to JwtModule.registerAsync() with ConfigService.
   */
  async getUserFromAccessToken(token: string): Promise<CurrentUser> {
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } =
      await this.supabaseService.supabase.auth.getUser(token);

    if (error || !data.user) {
      this.tokenCache.delete(token);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Login required',
      });
    }

    const user = await this.resolveCurrentUser(data.user);
    this.cacheToken(token, user);
    return user;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

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

    await this.supabaseService.admin.from('profiles').upsert(
      {
        id: fallbackUser.id,
        email: fallbackUser.email,
        role: fallbackUser.role,
        full_name: fallbackUser.full_name,
        phone: fallbackUser.phone,
      },
      { onConflict: 'id' },
    );

    return fallbackUser;
  }
}
