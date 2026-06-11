import 'dotenv/config';
import compression from 'compression';
import helmet from 'helmet';
import { HttpStatus, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet());

  // ── Response compression ───────────────────────────────────────────────────
  app.use(compression());

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = (
    process.env.CLIENT_URLS ??
    process.env.CLIENT_URL ??
    'http://localhost:5173'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      next();
      return;
    }

    const rid = request.requestId ?? '-';
    logger.warn(`CORS rejected origin: ${origin}`);
    response.status(HttpStatus.FORBIDDEN).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Origin is not allowed by CORS policy',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      requestId: rid,
    });
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow same-origin requests (origin is undefined for server-to-server or curl)
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

  // ── Request body limit ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use(require('express').json({ limit: '1mb' }));

  // ── Global prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation ──────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Exception filter ────────────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger (disabled in production) ────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EazySeva API')
      .setDescription('Government services platform — prototype API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── Start ───────────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(
    `Server listening on port ${port} [${process.env.NODE_ENV ?? 'development'}]`,
  );

  app.enableShutdownHooks();
}

bootstrap();
