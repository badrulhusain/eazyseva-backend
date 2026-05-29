import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        success: boolean;
        data: {
            id: any;
            email: any;
            full_name: string;
            phone: string;
        };
    }>;
    me(user: CurrentUserType): {
        success: boolean;
        data: CurrentUserType;
    };
}
