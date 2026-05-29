"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseJwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const supabase_service_1 = require("../../supabase/supabase.service");
let SupabaseJwtStrategy = class SupabaseJwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'supabase-jwt') {
    supabaseService;
    constructor(supabaseService) {
        const secret = process.env.SUPABASE_JWT_SECRET;
        if (!secret)
            throw new Error('SUPABASE_JWT_SECRET is not set');
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
        this.supabaseService = supabaseService;
    }
    async validate(payload) {
        const { data: profile, error } = await this.supabaseService.admin
            .from('profiles')
            .select('id, email, role, full_name, phone')
            .eq('id', payload.sub)
            .single();
        if (profile) {
            return {
                id: profile.id,
                email: profile.email,
                role: profile.role,
                full_name: profile.full_name ?? null,
                phone: profile.phone ?? null,
            };
        }
        if (error?.code !== 'PGRST116') {
            throw new common_1.UnauthorizedException({
                code: 'PROFILE_LOOKUP_FAILED',
                message: error?.message ?? 'Unable to load user profile',
            });
        }
        const fallbackUser = {
            id: payload.sub,
            email: payload.email,
            role: 'USER',
            full_name: payload.user_metadata?.full_name ?? null,
            phone: payload.user_metadata?.phone ?? null,
        };
        await this.supabaseService.admin.from('profiles').upsert({
            id: fallbackUser.id,
            email: fallbackUser.email,
            role: fallbackUser.role,
            full_name: fallbackUser.full_name,
            phone: fallbackUser.phone,
        }, { onConflict: 'id' });
        return fallbackUser;
    }
};
exports.SupabaseJwtStrategy = SupabaseJwtStrategy;
exports.SupabaseJwtStrategy = SupabaseJwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], SupabaseJwtStrategy);
//# sourceMappingURL=supabase-jwt.strategy.js.map