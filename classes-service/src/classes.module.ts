import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { LocationModule } from './location/location.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, LocationModule],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
