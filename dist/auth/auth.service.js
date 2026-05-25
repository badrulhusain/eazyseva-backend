"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const supabase_service_1 = require("../supabase/supabase.service");
let AuthService = class AuthService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async loginAdmin(username, password) {
        if (!username || !password)
            throw new common_1.UnauthorizedException('Username and password are required');
        const { data: admin, error } = await this.supabaseService.admin
            .from('Admin')
            .select('id, username, password')
            .eq('username', username)
            .single();
        if (error || !admin)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const email = `${username}@admin.ezyseva.local`;
        await this.ensureSupabaseUser(email, {
            role: 'admin',
            adminId: admin.id,
            username: admin.username,
        });
        const { data, error: linkError } = await this.supabaseService.admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });
        if (linkError || !data?.properties)
            throw new common_1.UnauthorizedException('Failed to generate session');
        return {
            token_hash: data.properties.hashed_token,
            type: 'magiclink',
            role: 'admin',
        };
    }
    async loginStudent(admissionNo) {
        if (!admissionNo)
            throw new common_1.UnauthorizedException('Admission number is required');
        const { data: student, error } = await this.supabaseService.admin
            .from('Student')
            .select('id, name, admissionNo, active')
            .eq('admissionNo', admissionNo)
            .single();
        if (error || !student)
            throw new common_1.UnauthorizedException('Student not found');
        if (!student.active)
            throw new common_1.UnauthorizedException('Student account is inactive');
        const email = `${admissionNo}@student.ezyseva.local`;
        await this.ensureSupabaseUser(email, {
            role: 'student',
            studentId: student.id,
            admissionNo: student.admissionNo,
            name: student.name,
        });
        const { data, error: linkError } = await this.supabaseService.admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
        });
        if (linkError || !data?.properties)
            throw new common_1.UnauthorizedException('Failed to generate session');
        return {
            token_hash: data.properties.hashed_token,
            type: 'magiclink',
            role: 'student',
        };
    }
    async getMe(user) {
        const role = user.user_metadata?.role;
        if (role === 'admin') {
            const { data: profile } = await this.supabaseService.admin
                .from('Admin')
                .select('id, username, createdAt')
                .eq('id', user.user_metadata.adminId)
                .single();
            return { id: user.id, role, profile };
        }
        if (role === 'student') {
            const { data: profile } = await this.supabaseService.admin
                .from('Student')
                .select('id, name, admissionNo, department, batch, active, createdAt')
                .eq('id', user.user_metadata.studentId)
                .single();
            return { id: user.id, role, profile };
        }
        throw new common_1.UnauthorizedException('Unknown role');
    }
    async ensureSupabaseUser(email, metadata) {
        const { error } = await this.supabaseService.admin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: metadata,
        });
        if (error && error.message !== 'User already registered') {
            throw new Error(`Auth user setup failed: ${error.message}`);
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], AuthService);
//# sourceMappingURL=auth.service.js.map