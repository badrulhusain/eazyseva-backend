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

  // In-process cache: avoids 2 Supabase RTTs (auth.getUser + profiles SELECT) on every
  // authenticated request. TTL of 60s is short enough to pick up bans/role changes quickly.
  private readonly tokenCache = new Map<string, { user: CurrentUser; expiresAt: number }>();
  private readonly TOKEN_CACHE_TTL = 60_000;
  private readonly TOKEN_CACHE_MAX = 500;

  async register(dto: RegisterDto) {
    const { data, error } = await this.supabaseService.admin.auth.admin.createUser({
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
      if (msg.includes('already') || msg.includes('email') && msg.includes('registered')) {
        throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email is already registered' });
      }
      this.logger.error(`Registration failed for ${dto.email}: ${error.message}`);
      throw new InternalServerErrorException({ code: 'REGISTER_FAILED', message: error.message });
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
    const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({
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

  async getUserFromAccessToken(token: string): Promise<CurrentUser> {
    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const { data, error } = await this.supabaseService.supabase.auth.getUser(token);

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
      // If no expired entries, evict the oldest (first-inserted) entry to stay bounded.
      if (!evictedExpired) {
        const oldest = this.tokenCache.keys().next().value;
        if (oldest !== undefined) this.tokenCache.delete(oldest);
      }
    }
    this.tokenCache.set(token, { user, expiresAt: Date.now() + this.TOKEN_CACHE_TTL });
  }

  async resolveCurrentUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<CurrentUser> {
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
