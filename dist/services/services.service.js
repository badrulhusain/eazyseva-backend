"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const services_seed_1 = require("./services.seed");
let ServicesService = class ServicesService {
    findAll(category) {
        return services_seed_1.servicesSeed
            .filter((service) => service.isActive)
            .filter((service) => !category || service.category === category)
            .sort((a, b) => {
            if (a.isPopular !== b.isPopular)
                return a.isPopular ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }
    findBySlug(slug) {
        const service = services_seed_1.servicesSeed.find((item) => item.slug === slug && item.isActive);
        if (!service) {
            throw new common_1.NotFoundException({
                code: 'SERVICE_NOT_FOUND',
                message: 'Service not found',
            });
        }
        return service;
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = __decorate([
    (0, common_1.Injectable)()
], ServicesService);
//# sourceMappingURL=services.service.js.map