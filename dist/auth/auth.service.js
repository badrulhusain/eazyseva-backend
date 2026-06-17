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
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const supabase_service_1 = require("../supabase/supabase.service");
const JWKS_CACHE_TTL_MS = 10 * 60_000;
const JWKS_FETCH_TIMEOUT_MS = 5_000;
const ASYMMETRIC_JWT_ALGORITHMS = [
    'RS256',
    'RS384',
    'RS512',
    'ES256',
    'ES384',
    'ES512',
];
let AuthService = AuthService_1 = class AuthService {
    supabaseService;
    jwtService;
    configService;
    logger = new common_1.Logger(AuthService_1.name);
    jwksCache = null;
    constructor(supabaseService, jwtService, configService) {
        this.supabaseService = supabaseService;
        this.jwtService = jwtService;
        this.configService = configService;
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
            if (msg.includes('already') ||
                (msg.includes('email') && msg.includes('registered'))) {
                throw new common_1.ConflictException({
                    code: 'EMAIL_TAKEN',
                    message: 'Email is already registered',
                });
            }
            this.logger.error(`Registration failed for ${dto.email}: ${error.message}`);
            throw new common_1.InternalServerErrorException({
                code: 'REGISTER_FAILED',
                message: error.message,
            });
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
        let payload;
        try {
            payload = await this.verifySupabaseAccessToken(token);
        }
        catch (error) {
            this.logger.warn(`Local JWT verification failed; falling back to Supabase Auth: ${error instanceof Error ? error.message : 'unknown error'}`);
            const user = await this.getUserFromSupabaseAuth(token);
            const currentUser = await this.resolveCurrentUser(user);
            this.cacheToken(token, currentUser);
            return currentUser;
        }
        try {
            if (!payload.sub) {
                this.tokenCache.delete(token);
                throw new common_1.UnauthorizedException({
                    code: 'UNAUTHORIZED',
                    message: 'Login required',
                });
            }
            const user = await this.resolveCurrentUser({
                id: payload.sub,
                email: this.extractEmail(payload),
                user_metadata: this.extractUserMetadata(payload),
            });
            this.cacheToken(token, user);
            return user;
        }
        catch (error) {
            this.tokenCache.delete(token);
            if (error instanceof common_1.UnauthorizedException)
                throw error;
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
    }
    async verifySupabaseAccessToken(token) {
        const decoded = this.jwtService.decode(token, {
            complete: true,
        });
        if (!decoded || typeof decoded.payload === 'string') {
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
        const alg = decoded.header.alg;
        if (alg === 'HS256') {
            return this.jwtService.verifyAsync(token, {
                secret: this.configService.getOrThrow('SUPABASE_JWT_SECRET'),
                algorithms: ['HS256'],
            });
        }
        if (!this.isSupportedAsymmetricAlgorithm(alg) || !decoded.header.kid) {
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
        const key = await this.getJwksKey(decoded.header.kid, alg);
        const publicKey = (0, crypto_1.createPublicKey)({
            key: key,
            format: 'jwk',
        }).export({ format: 'pem', type: 'spki' });
        return this.jwtService.verifyAsync(token, {
            secret: publicKey,
            algorithms: [alg],
        });
    }
    isSupportedAsymmetricAlgorithm(alg) {
        return ASYMMETRIC_JWT_ALGORITHMS.includes(alg);
    }
    async getJwksKey(kid, alg) {
        const keys = await this.getJwksKeys();
        const key = keys.find((candidate) => candidate.kid === kid);
        if (!key || (key.alg && key.alg !== alg)) {
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
        return key;
    }
    async getJwksKeys() {
        if (this.jwksCache && this.jwksCache.expiresAt > Date.now()) {
            return this.jwksCache.keys;
        }
        const supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
        const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', supabaseUrl).toString();
        const response = await fetch(jwksUrl, {
            signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
        const data = (await response.json());
        const keys = Array.isArray(data.keys) ? data.keys : [];
        this.jwksCache = {
            keys,
            expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
        };
        return keys;
    }
    async getUserFromSupabaseAuth(token) {
        const { data, error } = await this.supabaseService.supabase.auth.getUser(token);
        if (error || !data.user) {
            throw new common_1.UnauthorizedException({
                code: 'UNAUTHORIZED',
                message: 'Login required',
            });
        }
        return data.user;
    }
    extractEmail(payload) {
        return (payload.email ??
            this.readString(payload.user_metadata, 'email') ??
            this.readString(payload.user_metadata, 'email_address') ??
            '');
    }
    extractUserMetadata(payload) {
        return {
            ...(payload.user_metadata ?? {}),
            full_name: this.readString(payload.user_metadata, 'full_name') ??
                this.readString(payload.user_metadata, 'name') ??
                payload.name ??
                payload.user_name,
            phone: this.readString(payload.user_metadata, 'phone') ?? payload.phone,
            email: this.extractEmail(payload),
        };
    }
    readString(data, key) {
        const value = data?.[key];
        return typeof value === 'string' && value.trim() ? value : undefined;
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
        this.tokenCache.set(token, {
            user,
            expiresAt: Date.now() + this.TOKEN_CACHE_TTL,
        });
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
            full_name: this.readString(user.user_metadata, 'full_name') ??
                this.readString(user.user_metadata, 'name') ??
                null,
            phone: this.readString(user.user_metadata, 'phone') ?? null,
        };
        const { error: upsertError } = await this.supabaseService.admin
            .from('profiles')
            .upsert({
            id: fallbackUser.id,
            email: fallbackUser.email,
            role: fallbackUser.role,
            full_name: fallbackUser.full_name,
            phone: fallbackUser.phone,
        }, { onConflict: 'id' });
        if (upsertError) {
            this.logger.error(`Failed to repair missing profile for user=${fallbackUser.id}: ${upsertError.message}`);
            throw new common_1.UnauthorizedException({
                code: 'PROFILE_LOOKUP_FAILED',
                message: 'Unable to load user profile',
            });
        }
        return fallbackUser;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map