import { Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';
import type { CurrentUser } from '../../common/types/current-user.type';
interface JwtPayload {
    sub: string;
    email: string;
    aud?: string;
    role?: string;
}
declare const SupabaseJwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class SupabaseJwtStrategy extends SupabaseJwtStrategy_base {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    validate(payload: JwtPayload): Promise<CurrentUser>;
}
export {};
