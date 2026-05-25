import { Body, Controller, Get, Post } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('admin/login')
  adminLogin(@Body() body: { username: string; password: string }) {
    return this.authService.loginAdmin(body.username, body.password);
  }

  @Public()
  @Post('student/login')
  studentLogin(@Body() body: { admissionNo: string }) {
    return this.authService.loginStudent(body.admissionNo);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.authService.getMe(user);
  }
}
