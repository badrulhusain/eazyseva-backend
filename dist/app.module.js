"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const supabase_module_1 = require("./supabase/supabase.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const services_module_1 = require("./services/services.module");
const orders_module_1 = require("./orders/orders.module");
const uploads_module_1 = require("./uploads/uploads.module");
const payments_module_1 = require("./payments/payments.module");
const health_module_1 = require("./health/health.module");
const audit_logs_module_1 = require("./audit-logs/audit-logs.module");
const consent_module_1 = require("./consent/consent.module");
const blogs_module_1 = require("./blogs/blogs.module");
const documents_module_1 = require("./documents/documents.module");
const jwt_auth_guard_1 = require("./auth/guards/jwt-auth.guard");
const request_id_middleware_1 = require("./common/middleware/request-id.middleware");
const request_logger_middleware_1 = require("./common/middleware/request-logger.middleware");
const env_validation_1 = require("./config/env.validation");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_id_middleware_1.RequestIdMiddleware, request_logger_middleware_1.RequestLoggerMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                validate: env_validation_1.validateEnv,
            }),
            throttler_1.ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
            supabase_module_1.SupabaseModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            services_module_1.ServicesModule,
            orders_module_1.OrdersModule,
            uploads_module_1.UploadsModule,
            payments_module_1.PaymentsModule,
            health_module_1.HealthModule,
            audit_logs_module_1.AuditLogsModule,
            consent_module_1.ConsentModule,
            blogs_module_1.BlogsModule,
            documents_module_1.DocumentsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map