import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { UserRole } from '../enums/user-role';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const userServiceUrl = this.configService.get<string>(
      'USER_SERVICE_URL',
      'http://localhost:3003',
    );

    let resp: Response;
    try {
      resp = await fetch(`${userServiceUrl}/users/${userId}`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('User service unreachable');
    }

    if (resp.status >= 500) {
      throw new ServiceUnavailableException('User service error');
    }
    if (!resp.ok) {
      throw new UnauthorizedException('Failed to verify user');
    }

    const user = (await resp.json()) as { role: string; banned: boolean };
    if (user.banned) {
      throw new ForbiddenException('User is banned');
    }
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
