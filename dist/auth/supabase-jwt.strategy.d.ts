import { Strategy } from 'passport-jwt';
declare const SupabaseJwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class SupabaseJwtStrategy extends SupabaseJwtStrategy_base {
    constructor();
    validate(payload: {
        sub: string;
        email: string;
        user_metadata: Record<string, unknown>;
        app_metadata: Record<string, unknown>;
    }): Promise<{
        id: string;
        email: string;
        user_metadata: Record<string, unknown>;
        app_metadata: Record<string, unknown>;
    }>;
}
export {};
