import { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ContactRateLimitGuard } from './contact-rate-limit.guard';
import {
  ContactRateLimitService,
  RateLimitDecision,
} from '../../externalControllers/contact-rate-limit.service';

describe('ContactRateLimitGuard', () => {
  const response = { header: jest.fn() } as unknown as Response;
  const request = {
    ip: '198.51.100.10',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  const decision: RateLimitDecision = {
    allowed: true,
    limit: 100,
    remaining: 99,
    resetSeconds: 60,
  };

  it('tracks the request IP and allows requests under the circuit breaker', async () => {
    const consumeIp = jest.fn().mockResolvedValue(decision);
    const applyHeaders = jest.fn();
    const service = {
      consumeIp,
      applyHeaders,
    } as unknown as ContactRateLimitService;
    const guard = new ContactRateLimitGuard(service);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(consumeIp).toHaveBeenCalledWith('198.51.100.10');
    expect(applyHeaders).toHaveBeenCalledWith(response, decision, 'IP');
  });

  it('rejects requests over the circuit breaker', async () => {
    const service = {
      consumeIp: jest.fn().mockResolvedValue({ ...decision, allowed: false }),
      applyHeaders: jest.fn(),
    } as unknown as ContactRateLimitService;
    const guard = new ContactRateLimitGuard(service);

    await expect(guard.canActivate(context)).rejects.toEqual(
      expect.objectContaining({ status: 429 }),
    );
  });

  it('fails closed when Redis cannot be reached', async () => {
    const service = {
      consumeIp: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      applyHeaders: jest.fn(),
    } as unknown as ContactRateLimitService;
    const guard = new ContactRateLimitGuard(service);

    await expect(guard.canActivate(context)).rejects.toEqual(
      expect.objectContaining({ status: 503 }),
    );
  });
});
