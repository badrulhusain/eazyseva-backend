import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string) {
    const { data, error } = await this.supabaseService.admin
      .from('profiles')
      .select('id, email, role, full_name, phone, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    return data;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const patch: Record<string, unknown> = {};
    if (dto.full_name !== undefined) patch.full_name = dto.full_name;
    if (dto.phone !== undefined) patch.phone = dto.phone;

    const { data, error } = await this.supabaseService.admin
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('id, email, role, full_name, phone, created_at')
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    return data;
  }
}
