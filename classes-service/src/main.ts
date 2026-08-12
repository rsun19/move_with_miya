import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ClassesModule } from './classes.module';

config({ path: resolve(process.cwd(), '../.env') });

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ClassesModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: 'classes_queue',
        queueOptions: { durable: true },
      },
    },
  );
  await app.listen();
}
void bootstrap();
