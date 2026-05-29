import { SupabaseService } from '../../supabase/supabase.service';
import type { CurrentUser } from '../../common/types/current-user.type';
interface JwtPayload {
    sub: string;
    email: string;
    aud?: string;
    role?: string;
    user_metadata?: {
        full_name?: string;
        phone?: string;
    };
}
declare const SupabaseJwtStrategy_base: any;
export declare class SupabaseJwtStrategy extends SupabaseJwtStrategy_base {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    validate(payload: JwtPayload): Promise<CurrentUser>;
}
export {};
