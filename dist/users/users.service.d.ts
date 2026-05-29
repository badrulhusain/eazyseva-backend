import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    getProfile(userId: string): Promise<any>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<any>;
}
