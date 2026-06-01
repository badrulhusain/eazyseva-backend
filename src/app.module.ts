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
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

function validateEnv(config: Record<string, unknown>) {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_JWT_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];

  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return config;
}

@Module({
  imports: [
    // Config + startup env validation
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // Rate limiting: 100 requests / 60 s per IP (global default)
    // Sensitive endpoints (login, register) override with stricter limits via @Throttle()
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),

    SupabaseModule,
    AuthModule,
    UsersModule,
    ServicesModule,
    OrdersModule,
    UploadsModule,
    PaymentsModule,
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
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
