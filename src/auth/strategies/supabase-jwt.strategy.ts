import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';
import type { CurrentUser } from '../../common/types/current-user.type';

interface JwtPayload {
  sub: string;
  email: string;
  aud?: string;
  role?: string;
  user_metadata?: {
    full_name?: string;
    phone?: string;
  };
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor(private readonly supabaseService: SupabaseService) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    const { data: profile, error } = await this.supabaseService.admin
      .from('profiles')
      .select('id, email, role, full_name, phone')
      .eq('id', payload.sub)
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
      id: payload.sub,
      email: payload.email,
      role: 'USER',
      full_name: payload.user_metadata?.full_name ?? null,
      phone: payload.user_metadata?.phone ?? null,
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
