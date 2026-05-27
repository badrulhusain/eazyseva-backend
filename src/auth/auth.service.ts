import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/types/current-user.type';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

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
      throw new InternalServerErrorException({ code: 'REGISTER_FAILED', message: error.message });
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

  getMe(user: CurrentUser) {
    return { success: true, data: user };
  }
}
