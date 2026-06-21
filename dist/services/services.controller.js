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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminServicesController = exports.ServicesController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const admin_guard_1 = require("../auth/guards/admin.guard");
const services_service_1 = require("./services.service");
const create_service_dto_1 = require("./dto/create-service.dto");
const query_service_dto_1 = require("./dto/query-service.dto");
const update_service_dto_1 = require("./dto/update-service.dto");
let ServicesController = class ServicesController {
    servicesService;
    constructor(servicesService) {
        this.servicesService = servicesService;
    }
    async findAll(query) {
        const result = await this.servicesService.findAll(query);
        return { success: true, ...result };
    }
    async findBySlug(slug) {
        const data = await this.servicesService.findBySlug(slug);
        return { success: true, data };
    }
};
exports.ServicesController = ServicesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_service_dto_1.ServiceQueryDto]),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "findBySlug", null);
exports.ServicesController = ServicesController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('services'),
    __metadata("design:paramtypes", [services_service_1.ServicesService])
], ServicesController);
let AdminServicesController = class AdminServicesController {
    servicesService;
    constructor(servicesService) {
        this.servicesService = servicesService;
    }
    async findAll(query) {
        const result = await this.servicesService.findAllAdmin(query);
        return { success: true, ...result };
    }
    async findById(id) {
        const data = await this.servicesService.findById(id);
        return { success: true, data };
    }
    async create(dto) {
        const data = await this.servicesService.create(dto);
        return { success: true, data };
    }
    async update(id, dto) {
        const data = await this.servicesService.update(id, dto);
        return { success: true, data };
    }
    async remove(id) {
        const data = await this.servicesService.softDelete(id);
        return { success: true, data };
    }
};
exports.AdminServicesController = AdminServicesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_service_dto_1.ServiceQueryDto]),
    __metadata("design:returntype", Promise)
], AdminServicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminServicesController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_service_dto_1.CreateServiceDto]),
    __metadata("design:returntype", Promise)
], AdminServicesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_service_dto_1.UpdateServiceDto]),
    __metadata("design:returntype", Promise)
], AdminServicesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminServicesController.prototype, "remove", null);
exports.AdminServicesController = AdminServicesController = __decorate([
    (0, common_1.UseGuards)(admin_guard_1.AdminGuard),
    (0, common_1.Controller)('admin/services'),
    __metadata("design:paramtypes", [services_service_1.ServicesService])
], AdminServicesController);
//# sourceMappingURL=services.controller.js.map