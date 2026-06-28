import { NestFactory } from '@nestjs/core';
import { RegistrationModule } from './registration.module';

async function bootstrap() {
  const app = await NestFactory.create(RegistrationModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
