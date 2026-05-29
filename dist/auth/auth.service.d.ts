import { SupabaseService } from '../supabase/supabase.service';
import type { CurrentUser } from '../common/types/current-user.type';
import type { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    register(dto: RegisterDto): Promise<{
        success: boolean;
        data: {
            id: any;
            email: any;
            full_name: string;
            phone: string;
        };
    }>;
    getMe(user: CurrentUser): {
        success: boolean;
        data: CurrentUser;
    };
}
