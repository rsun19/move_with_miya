import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const userId = request.session?.userId;
    if (!userId) {
      throw new Error('CurrentUser decorator requires an active session');
    }
    return userId;
  },
);
