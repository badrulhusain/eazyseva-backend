import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/types/current-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    register(dto: RegisterDto): Promise<{
        success: boolean;
        data: {
            id: string;
            email: string | undefined;
            full_name: string;
            phone: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        success: boolean;
        data: {
            user: CurrentUser;
            accessToken: string;
            refreshToken: string;
            expiresAt: number | null;
        };
    }>;
    getMe(user: CurrentUser): {
        success: boolean;
        data: CurrentUser;
    };
    getUserFromAccessToken(token: string): Promise<CurrentUser>;
    resolveCurrentUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<CurrentUser>;
}
