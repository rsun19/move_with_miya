import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TurnstileValidationResponse {
  success: boolean;
  action?: string;
  hostname?: string;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const secret = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      this.logger.error('Turnstile is not configured');
      return false;
    }

    try {
      const payload: {
        secret: string;
        response: string;
        remoteip?: string;
      } = { secret, response: token };
      if (remoteIp) payload.remoteip = remoteIp;

      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Turnstile rejected verification (${response.status})`,
        );
        return false;
      }

      const result = (await response.json()) as TurnstileValidationResponse;
      const expectedAction = this.configService.get<string>(
        'TURNSTILE_ACTION',
        'contact',
      );
      const expectedHostname =
        this.configService.get<string>('TURNSTILE_HOSTNAME');

      return (
        result.success &&
        result.action === expectedAction &&
        (!expectedHostname || result.hostname === expectedHostname)
      );
    } catch (error) {
      this.logger.error('Turnstile verification failed', error);
      return false;
    }
  }
}
