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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let UsersService = class UsersService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async getProfile(userId) {
        const { data, error } = await this.supabaseService.admin
            .from('profiles')
            .select('id, email, role, full_name, phone, created_at')
            .eq('id', userId)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({
                code: 'PROFILE_NOT_FOUND',
                message: 'Profile not found',
            });
        }
        return data;
    }
    async updateProfile(userId, dto) {
        const patch = {};
        if (dto.full_name !== undefined)
            patch.full_name = dto.full_name;
        if (dto.phone !== undefined)
            patch.phone = dto.phone;
        const { data, error } = await this.supabaseService.admin
            .from('profiles')
            .update(patch)
            .eq('id', userId)
            .select('id, email, role, full_name, phone, created_at')
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({
                code: 'PROFILE_NOT_FOUND',
                message: 'Profile not found',
            });
        }
        return data;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map