import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionUserId = request.session?.userId;
    const targetUserId = request.params.id;

    if (!sessionUserId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const sessionUser = await this.usersService.findById(sessionUserId);
    if (sessionUser.banned) {
      throw new ForbiddenException('User is banned');
    }

    if (sessionUserId === targetUserId) return true;

    if (sessionUser.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
