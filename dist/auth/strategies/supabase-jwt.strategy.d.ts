import { Strategy } from 'passport-jwt';
import type { CurrentUser } from '../../common/types/current-user.type';
import { AuthService } from '../auth.service';
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
declare const SupabaseJwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class SupabaseJwtStrategy extends SupabaseJwtStrategy_base {
    private readonly authService;
    constructor(authService: AuthService);
    validate(payload: JwtPayload): Promise<CurrentUser>;
}
export {};
