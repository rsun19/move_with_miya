import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import { createClient } from 'redis';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RedisStore } = require('connect-redis') as {
  RedisStore: new (opts: {
    client: import('redis').RedisClientType;
  }) => import('express-session').Store;
};
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV');
  const sessionSecret = configService.get<string>('SESSION_SECRET');
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
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
        'CORS_ORIGIN must be a single HTTPS origin in production',
      );
    }
  }

  const redisClient = createClient({
    url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
  });
  await redisClient.connect();

  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: sessionSecret || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.enableCors({
    origin: corsOrigin || 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = configService.get<number>('PORT', 3003);
  await app.listen(port);
  console.log(`user-service listening on http://localhost:${port}`);
}
void bootstrap();
