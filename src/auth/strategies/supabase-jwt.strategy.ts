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

    if (error || !profile) {
      throw new UnauthorizedException({
        code: 'PROFILE_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    return {
      id: profile.id as string,
      email: profile.email as string,
      role: profile.role as 'USER' | 'ADMIN',
      full_name: (profile.full_name as string) ?? null,
      phone: (profile.phone as string) ?? null,
    };
  }
}
