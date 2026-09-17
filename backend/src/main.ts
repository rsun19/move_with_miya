import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import session from 'express-session';
import { AppModule } from './app.module';
import { RedisService } from './redis.service';
import type { RedisClient } from './redis.service';
import express from 'express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RedisStore } = require('connect-redis') as {
  RedisStore: new (opts: {
    client: RedisClient;
  }) => import('express-session').Store;
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV');
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const sessionSecret = configService.get<string>('SESSION_SECRET');
  if (
    nodeEnv === 'production' &&
    (!sessionSecret ||
      sessionSecret.length < 32 ||
      [
        'change-me-to-a-random-string',
        'dev-secret-change-in-production',
      ].includes(sessionSecret))
  ) {
    throw new Error(
      'SESSION_SECRET must be a strong, non-placeholder value in production',
    );
  }
  if (nodeEnv === 'production') {
    let parsedOrigin: URL | undefined;
    try {
      parsedOrigin = corsOrigin ? new URL(corsOrigin) : undefined;
    } catch {
      parsedOrigin = undefined;
    }
    if (
      !parsedOrigin ||
      parsedOrigin.protocol !== 'https:' ||
      parsedOrigin.origin !== corsOrigin
    ) {
      throw new Error(
        'CORS_ORIGIN must be a single valid origin in production',
      );
    }
  }

  app.enableCors({
    origin: corsOrigin || 'http://localhost:5173',
    credentials: true,
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [
        configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672'),
      ],
      queue: 'registration_events',
      queueOptions: { durable: true },
    },
  });

  app.set('trust proxy', nodeEnv === 'production' ? 1 : false);

  const redisService = app.get(RedisService);
  await redisService.connect();

  app.use(
    '/checkout/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
  );
  app.use(express.json({ limit: '256kb' }));

  app.use(
    session({
      store: new RedisStore({ client: redisService.getClient() }),
      secret: sessionSecret || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = configService.get<number>('PORT', 3002);
  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`backend listening on http://localhost:${port}`);
}
void bootstrap();
