import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/types/current-user.type';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly supabaseService;
    private readonly jwtService;
    private readonly configService;
    private readonly logger;
    private jwksCache;
    constructor(supabaseService: SupabaseService, jwtService: JwtService, configService: ConfigService);
    private readonly tokenCache;
    private readonly TOKEN_CACHE_TTL;
    private readonly TOKEN_CACHE_MAX;
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
    private verifySupabaseAccessToken;
    private isSupportedAsymmetricAlgorithm;
    private getJwksKey;
    private getJwksKeys;
    private cacheToken;
    resolveCurrentUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<CurrentUser>;
}
