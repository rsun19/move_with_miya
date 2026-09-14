import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RedisService } from '../redis.service';

export const CONTACT_VISITOR_COOKIE = 'contact_visitor';

const VISITOR_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('PTTL', KEYS[1]) }
`;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

type RateLimitScope = 'IP' | 'Visitor';

@Injectable()
export class ContactRateLimitService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  getVisitorId(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return undefined;

    for (const cookie of cookieHeader.split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0) continue;
      const name = cookie.slice(0, separator).trim();
      if (name !== CONTACT_VISITOR_COOKIE) continue;

      const value = cookie.slice(separator + 1).trim();
      if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
      return undefined;
    }

    return undefined;
  }

  ensureVisitorCookie(request: Request, response: Response): string {
    const existing = this.getVisitorId(request);
    if (existing) return existing;

    const visitorId = randomBytes(32).toString('base64url');
    response.cookie(CONTACT_VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: VISITOR_COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return visitorId;
  }

  async consumeIp(ip: string): Promise<RateLimitDecision> {
    return this.consume(
      'ip',
      ip || 'unknown',
      this.getPositiveInteger('CONTACT_IP_ATTEMPT_LIMIT', 100),
      this.getPositiveInteger('CONTACT_IP_ATTEMPT_TTL_MS', 10 * 60 * 1000),
    );
  }

  async consumeVerifiedSubmission(
    visitorId: string,
  ): Promise<RateLimitDecision> {
    return this.consume(
      'visitor',
      visitorId,
      this.getPositiveInteger('CONTACT_COOKIE_SUBMISSION_LIMIT', 3),
      this.getPositiveInteger(
        'CONTACT_COOKIE_SUBMISSION_TTL_MS',
        60 * 60 * 1000,
      ),
    );
  }

  applyHeaders(
    response: Response,
    decision: RateLimitDecision,
    scope: RateLimitScope,
  ): void {
    response.header('X-RateLimit-Limit', String(decision.limit));
    response.header('X-RateLimit-Remaining', String(decision.remaining));
    response.header('X-RateLimit-Reset', String(decision.resetSeconds));
    response.header(`X-RateLimit-${scope}-Limit`, String(decision.limit));
    response.header(
      `X-RateLimit-${scope}-Remaining`,
      String(decision.remaining),
    );
    response.header(
      `X-RateLimit-${scope}-Reset`,
      String(decision.resetSeconds),
    );
    if (!decision.allowed) {
      response.header('Retry-After', String(decision.resetSeconds));
    }
  }

  private async consume(
    scope: string,
    identifier: string,
    limit: number,
    ttlMs: number,
  ): Promise<RateLimitDecision> {
    const window = Math.floor(Date.now() / ttlMs);
    const key = `${this.getPrefix()}:${scope}:${this.hash(
      `${identifier}:${window}`,
    )}`;
    const result = await this.redisService
      .getClient()
      .sendCommand(['EVAL', INCREMENT_SCRIPT, '1', key, String(ttlMs)]);
    const [countValue, ttlValue] = result as unknown as [
      string | number,
      string | number,
    ];
    const count = Number(countValue);
    const ttl = Math.max(1, Number(ttlValue));
    const resetSeconds = Math.max(1, Math.ceil(ttl / 1000));

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds,
    };
  }

  private getPrefix(): string {
    return this.configService.get<string>(
      'CONTACT_RATE_LIMIT_PREFIX',
      'contact-rate-limit',
    );
  }

  private hash(value: string): string {
    const secret =
      this.configService.get<string>('CONTACT_CHALLENGE_SECRET') ||
      this.configService.get<string>('SESSION_SECRET');
    if (!secret) throw new Error('Rate-limit secret is not configured');
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private getPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
