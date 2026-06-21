import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { OrdersModule } from './orders/orders.module';
import { UploadsModule } from './uploads/uploads.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthModule } from './health/health.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ConsentModule } from './consent/consent.module';
import { BlogsModule } from './blogs/blogs.module';
import { DocumentsModule } from './documents/documents.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // Config + startup env validation
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    // Rate limiting: 100 requests / 60 s per IP (global default)
    // Sensitive endpoints (login, register) override with stricter limits via @Throttle()
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),

    SupabaseModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    OrdersModule,
    UploadsModule,
    PaymentsModule,
    HealthModule,
    AuditLogsModule,
    ConsentModule,
    BlogsModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Auth guard — applied globally; use @Public() to bypass on open routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Rate-limit guard — applied globally after auth
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RequestIdMiddleware MUST run first so every subsequent middleware and
    // guard can read req.requestId.
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
