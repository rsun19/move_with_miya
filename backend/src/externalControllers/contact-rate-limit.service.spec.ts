import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  ContactRateLimitService,
  CONTACT_VISITOR_COOKIE,
} from './contact-rate-limit.service';
import { RedisService } from '../redis.service';

describe('ContactRateLimitService', () => {
  const sendCommand = jest.fn();
  const redisService = {
    getClient: () => ({ sendCommand }),
  } as unknown as RedisService;
  const config = new ConfigService({
    SESSION_SECRET: 'test-secret',
    CONTACT_RATE_LIMIT_PREFIX: 'test-rate-limit',
    CONTACT_IP_ATTEMPT_LIMIT: '2',
    CONTACT_IP_ATTEMPT_TTL_MS: '60000',
    CONTACT_COOKIE_SUBMISSION_LIMIT: '3',
    CONTACT_COOKIE_SUBMISSION_TTL_MS: '3600000',
  });

  beforeEach(() => {
    sendCommand.mockReset();
    sendCommand.mockResolvedValue(['1', '60000']);
  });

  it('uses an atomic Redis script and allows requests through the configured limit', async () => {
    const service = new ContactRateLimitService(redisService, config);

    await expect(service.consumeIp('198.51.100.10')).resolves.toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetSeconds: 60,
    });
    expect(sendCommand).toHaveBeenCalledWith(
      expect.arrayContaining([
        'EVAL',
        expect.any(String),
        '1',
        expect.any(String),
        '60000',
      ]),
    );
  });

  it('blocks after the limit and never reports negative remaining capacity', async () => {
    sendCommand.mockResolvedValue(['3', '1000']);
    const service = new ContactRateLimitService(redisService, config);

    await expect(service.consumeIp('198.51.100.10')).resolves.toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetSeconds: 1,
    });
  });

  it('uses different Redis keys for different scopes and identifiers', async () => {
    const service = new ContactRateLimitService(redisService, config);

    await service.consumeIp('198.51.100.10');
    await service.consumeIp('198.51.100.11');
    await service.consumeVerifiedSubmission('visitor-id');

    const keys = sendCommand.mock.calls.map(
      (call: unknown[]) => (call[0] as unknown[])[3] as string,
    );
    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toContain(':ip:');
    expect(keys[2]).toContain(':visitor:');
  });

  it('propagates Redis failures so callers can fail closed', async () => {
    sendCommand.mockRejectedValue(new Error('Redis unavailable'));
    const service = new ContactRateLimitService(redisService, config);

    await expect(service.consumeIp('198.51.100.10')).rejects.toThrow(
      'Redis unavailable',
    );
  });

  it('reads valid visitor cookies and ignores malformed values', () => {
    const service = new ContactRateLimitService(redisService, config);
    const visitorId = 'a'.repeat(43);

    expect(
      service.getVisitorId({
        headers: { cookie: `${CONTACT_VISITOR_COOKIE}=${visitorId}` },
      } as Request),
    ).toBe(visitorId);
    expect(
      service.getVisitorId({
        headers: { cookie: `${CONTACT_VISITOR_COOKIE}=not-valid` },
      } as Request),
    ).toBeUndefined();
  });

  it('issues a random HttpOnly visitor cookie only when one is absent', () => {
    const service = new ContactRateLimitService(redisService, config);
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;
    const request = { headers: {} } as Request;

    const visitorId = service.ensureVisitorCookie(request, response);
    expect(visitorId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie).toHaveBeenCalledWith(
      CONTACT_VISITOR_COOKIE,
      visitorId,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }),
    );

    cookie.mockClear();
    expect(
      service.ensureVisitorCookie(
        {
          headers: { cookie: `${CONTACT_VISITOR_COOKIE}=${visitorId}` },
        } as Request,
        response,
      ),
    ).toBe(visitorId);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('sets standard and scoped rate-limit headers', () => {
    const service = new ContactRateLimitService(redisService, config);
    const header = jest.fn();
    const response = { header } as unknown as Response;

    service.applyHeaders(
      response,
      { allowed: false, limit: 3, remaining: 0, resetSeconds: 12 },
      'Visitor',
    );

    expect(header).toHaveBeenCalledWith('X-RateLimit-Limit', '3');
    expect(header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    expect(header).toHaveBeenCalledWith('X-RateLimit-Reset', '12');
    expect(header).toHaveBeenCalledWith('X-RateLimit-Visitor-Limit', '3');
    expect(header).toHaveBeenCalledWith('Retry-After', '12');
  });
});
