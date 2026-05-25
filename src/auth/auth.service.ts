import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async loginAdmin(username: string, password: string) {
    if (!username || !password)
      throw new UnauthorizedException('Username and password are required');

    const { data: admin, error } = await this.supabaseService.admin
      .from('Admin')
      .select('id, username, password')
      .eq('username', username)
      .single();

    if (error || !admin) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const email = `${username}@admin.ezyseva.local`;
    await this.ensureSupabaseUser(email, {
      role: 'admin',
      adminId: admin.id,
      username: admin.username,
    });

    const { data, error: linkError } =
      await this.supabaseService.admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

    if (linkError || !data?.properties)
      throw new UnauthorizedException('Failed to generate session');

    return {
      token_hash: data.properties.hashed_token,
      type: 'magiclink' as const,
      role: 'admin' as const,
    };
  }

  async loginStudent(admissionNo: string) {
    if (!admissionNo)
      throw new UnauthorizedException('Admission number is required');

    const { data: student, error } = await this.supabaseService.admin
      .from('Student')
      .select('id, name, admissionNo, active')
      .eq('admissionNo', admissionNo)
      .single();

    if (error || !student) throw new UnauthorizedException('Student not found');
    if (!student.active) throw new UnauthorizedException('Student account is inactive');

    const email = `${admissionNo}@student.ezyseva.local`;
    await this.ensureSupabaseUser(email, {
      role: 'student',
      studentId: student.id,
      admissionNo: student.admissionNo,
      name: student.name,
    });

    const { data, error: linkError } =
      await this.supabaseService.admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

    if (linkError || !data?.properties)
      throw new UnauthorizedException('Failed to generate session');

    return {
      token_hash: data.properties.hashed_token,
      type: 'magiclink' as const,
      role: 'student' as const,
    };
  }

  async getMe(user: User) {
    const role = user.user_metadata?.role as 'admin' | 'student' | undefined;

    if (role === 'admin') {
      const { data: profile } = await this.supabaseService.admin
        .from('Admin')
        .select('id, username, createdAt')
        .eq('id', user.user_metadata.adminId)
        .single();
      return { id: user.id, role, profile };
    }

    if (role === 'student') {
      const { data: profile } = await this.supabaseService.admin
        .from('Student')
        .select('id, name, admissionNo, department, batch, active, createdAt')
        .eq('id', user.user_metadata.studentId)
        .single();
      return { id: user.id, role, profile };
    }

    throw new UnauthorizedException('Unknown role');
  }

  private async ensureSupabaseUser(
    email: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService.admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error && error.message !== 'User already registered') {
      throw new Error(`Auth user setup failed: ${error.message}`);
    }
  }
}
