import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    getProfile(userId: string): Promise<{
        id: any;
        email: any;
        role: any;
        full_name: any;
        phone: any;
        created_at: any;
    }>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        id: any;
        email: any;
        role: any;
        full_name: any;
        phone: any;
        created_at: any;
    }>;
}
