import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { SelfOrAdminGuard } from '../common/guards/self-or-admin.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AdminGuard, SelfOrAdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
