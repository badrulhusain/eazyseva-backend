"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const common_2 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const logger = new common_1.Logger('Bootstrap');
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    const allowedOrigins = (process.env.CLIENT_URLS ??
        process.env.CLIENT_URL ??
        'http://localhost:5173')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    app.use((request, response, next) => {
        const origin = request.headers.origin;
        if (!origin || allowedOrigins.includes(origin)) {
            next();
            return;
        }
        const rid = request.requestId ?? '-';
        logger.warn(`CORS rejected origin: ${origin}`);
        response.status(common_1.HttpStatus.FORBIDDEN).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Origin is not allowed by CORS policy',
            path: request.originalUrl,
            timestamp: new Date().toISOString(),
            requestId: rid,
        });
    });
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    });
    app.use(require('express').json({ limit: '1mb' }));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_2.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    if (process.env.NODE_ENV !== 'production') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('EazySeva API')
            .setDescription('Government services platform — prototype API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    logger.log(`Server listening on port ${port} [${process.env.NODE_ENV ?? 'development'}]`);
    app.enableShutdownHooks();
}
bootstrap();
//# sourceMappingURL=main.js.map