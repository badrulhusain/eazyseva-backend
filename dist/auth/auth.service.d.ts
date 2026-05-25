import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
export declare class AuthService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    loginAdmin(username: string, password: string): Promise<{
        token_hash: string;
        type: "magiclink";
        role: "admin";
    }>;
    loginStudent(admissionNo: string): Promise<{
        token_hash: string;
        type: "magiclink";
        role: "student";
    }>;
    getMe(user: User): Promise<{
        id: string;
        role: "admin";
        profile: {
            id: any;
            username: any;
            createdAt: any;
        } | null;
    } | {
        id: string;
        role: "student";
        profile: {
            id: any;
            name: any;
            admissionNo: any;
            department: any;
            batch: any;
            active: any;
            createdAt: any;
        } | null;
    }>;
    private ensureSupabaseUser;
}
