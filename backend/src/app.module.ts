import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClassesController } from './externalControllers/ClassesController';
import { LocationController } from './externalControllers/LocationController';
import { RegistrationController } from './externalControllers/RegistrationController';
import { ContactController } from './externalControllers/ContactController';
import { AdminGuard } from './common/guards/admin.guard';
import { StaffGuard } from './common/guards/staff.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env.local', '../.env'],
    }),
    ClientsModule.register([
      {
        name: 'CLASSES_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
          queue: 'classes_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'REGISTRATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
          queue: 'registration_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [
    AppController,
    ClassesController,
    LocationController,
    RegistrationController,
    ContactController,
  ],
  providers: [AppService, AdminGuard, StaffGuard],
})
export class AppModule {}
