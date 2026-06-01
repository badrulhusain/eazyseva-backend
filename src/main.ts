import 'dotenv/config';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Keep NestJS logger active; RequestLoggerMiddleware adds HTTP-level logs.
    logger: ['error', 'warn', 'log'],
  });

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Request body limit (protects against large JSON payloads) ───────────────
  app.use(require('express').json({ limit: '1mb' }));

  // ── Global prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation ──────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Reject unknown properties with 400
      transform: true,           // Auto-cast @Param/@Query primitives
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Exception filter ────────────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Start ───────────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Graceful shutdown
  app.enableShutdownHooks();
}

bootstrap();
