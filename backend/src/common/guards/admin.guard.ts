import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

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
      'http://localhost:3001',
    );

    const resp = await fetch(`${userServiceUrl}/users/${userId}`);
    if (!resp.ok) {
      throw new UnauthorizedException('Failed to verify user');
    }

    const user = (await resp.json()) as { role: string };
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
