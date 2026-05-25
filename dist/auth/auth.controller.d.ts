import type { User } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    adminLogin(body: {
        username: string;
        password: string;
    }): Promise<{
        token_hash: string;
        type: "magiclink";
        role: "admin";
    }>;
    studentLogin(body: {
        admissionNo: string;
    }): Promise<{
        token_hash: string;
        type: "magiclink";
        role: "student";
    }>;
    me(user: User): Promise<{
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
}
