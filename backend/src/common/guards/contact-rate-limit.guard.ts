import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ContactRateLimitService,
  RateLimitDecision,
} from '../../externalControllers/contact-rate-limit.service';

@Injectable()
export class ContactRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: ContactRateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    let decision: RateLimitDecision;
    try {
      decision = await this.rateLimitService.consumeIp(
        request.ip || request.socket.remoteAddress || 'unknown',
      );
    } catch {
      throw new ServiceUnavailableException(
        'Contact service is temporarily unavailable',
      );
    }

    this.rateLimitService.applyHeaders(response, decision, 'IP');
    if (!decision.allowed) {
      throw new HttpException(
        'Too many contact requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
