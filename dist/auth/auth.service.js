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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let AuthService = AuthService_1 = class AuthService {
    supabaseService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    tokenCache = new Map();
    TOKEN_CACHE_TTL = 60_000;
    TOKEN_CACHE_MAX = 500;
    async register(dto) {
        const { data, error } = await this.supabaseService.admin.auth.admin.createUser({
            email: dto.email,
            password: dto.password,
            email_confirm: true,
            user_metadata: {
                full_name: dto.full_name,
                phone: dto.phone,
            },
        });
        if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('already') || msg.includes('email') && msg.includes('registered')) {
                throw new common_1.ConflictException({ code: 'EMAIL_TAKEN', message: 'Email is already registered' });
            }
            this.logger.error(`Registration failed for ${dto.email}: ${error.message}`);
            throw new common_1.InternalServerErrorException({ code: 'REGISTER_FAILED', message: error.message });
        }
        this.logger.log(`User registered: ${data.user.id}`);
        const { error: profileError } = await this.supabaseService.admin
            .from('profiles')
            .upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: dto.full_name,
            phone: dto.phone,
            role: 'USER',
        }, { onConflict: 'id' });
        if (profileError) {
            throw new common_1.InternalServerErrorException({
                code: 'PROFILE_CREATE_FAILED',
                message: profileError.message,
            });
        }
        return {
            success: true,
            data: {
                id: data.user.id,
                email: data.user.email,
                full_name: dto.full_name,
                phone: dto.phone,
            },
        };
    }
    async login(dto) {
        const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({
            email: dto.email,
            password: dto.password,
        });
        if (error || !data.session || !data.user) {
            throw new common_1.UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password',
            });
        }
        const user = await this.resolveCurrentUser(data.user);
        return {
            success: true,
            data: {
                user,
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresAt: data.session.expires_at ?? null,
            },
        };
    }
    getMe(user) {
        return { success: true, data: user };
    }
    async getUserFromAccessToken(token) {
        const cached = this.tokenCache.get(token);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.user;
        }
        const { data, error } = await this.supabaseService.supabase.auth.getUser(token);
        if (error || !data.user) {
            this.tokenCache.delete(token);
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
        const user = await this.resolveCurrentUser(data.user);
        this.cacheToken(token, user);
        return user;
    }
    cacheToken(token, user) {
        if (this.tokenCache.size >= this.TOKEN_CACHE_MAX) {
            const now = Date.now();
            let evictedExpired = false;
            for (const [k, v] of this.tokenCache) {
                if (v.expiresAt <= now) {
                    this.tokenCache.delete(k);
                    evictedExpired = true;
                }
            }
            if (!evictedExpired) {
                const oldest = this.tokenCache.keys().next().value;
                if (oldest !== undefined)
                    this.tokenCache.delete(oldest);
            }
        }
        this.tokenCache.set(token, { user, expiresAt: Date.now() + this.TOKEN_CACHE_TTL });
    }
    async resolveCurrentUser(user) {
        const { data: profile, error } = await this.supabaseService.admin
            .from('profiles')
            .select('id, email, role, full_name, phone')
            .eq('id', user.id)
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
            id: user.id,
            email: user.email ?? '',
            role: 'USER',
            full_name: user.user_metadata?.full_name ?? null,
            phone: user.user_metadata?.phone ?? null,
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
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], AuthService);
//# sourceMappingURL=auth.service.js.map