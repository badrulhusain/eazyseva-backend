import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { CurrentUser } from '../../common/types/current-user.type';
import { AuthService } from '../auth.service';

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
  constructor(private readonly authService: AuthService) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    return this.authService.resolveCurrentUser({
      id: payload.sub,
      email: payload.email,
      user_metadata: {
        full_name: payload.user_metadata?.full_name,
        phone: payload.user_metadata?.phone,
      },
    });
  }
}
