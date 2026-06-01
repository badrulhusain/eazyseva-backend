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
var SupabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const common_1 = require("@nestjs/common");
const supabase_js_1 = require("@supabase/supabase-js");
let SupabaseService = SupabaseService_1 = class SupabaseService {
    logger = new common_1.Logger(SupabaseService_1.name);
    client;
    adminClient;
    constructor() {
        const url = process.env.SUPABASE_URL;
        const anonKey = process.env.SUPABASE_ANON_KEY;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url)
            throw new Error('Missing env var: SUPABASE_URL');
        if (!anonKey)
            throw new Error('Missing env var: SUPABASE_ANON_KEY');
        if (!serviceRoleKey) {
            this.logger.warn('SUPABASE_SERVICE_ROLE_KEY is not set — admin client will use anon key (RLS enforced)');
        }
        this.client = (0, supabase_js_1.createClient)(url, anonKey);
        this.adminClient = (0, supabase_js_1.createClient)(url, serviceRoleKey ?? anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    get supabase() {
        return this.client;
    }
    get admin() {
        return this.adminClient;
    }
};
exports.SupabaseService = SupabaseService;
exports.SupabaseService = SupabaseService = SupabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SupabaseService);
//# sourceMappingURL=supabase.service.js.map