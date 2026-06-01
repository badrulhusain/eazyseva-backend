import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
            user: CurrentUserType;
            accessToken: string;
            refreshToken: string;
            expiresAt: number | null;
        };
    }>;
    me(user: CurrentUserType): {
        success: boolean;
        data: CurrentUserType;
    };
}
