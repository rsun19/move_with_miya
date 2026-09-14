import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MINIMUM_AGE_MS = 3_000;
const DEFAULT_MAXIMUM_AGE_MS = 30 * 60 * 1000;

@Injectable()
export class ContactChallengeService {
  constructor(private readonly configService: ConfigService) {}

  issue(visitorId?: string): string {
    const issuedAt = Date.now().toString();
    const nonce = randomBytes(16).toString('hex');
    const binding = visitorId ?? '';
    return `${issuedAt}.${nonce}.${this.sign(`${issuedAt}.${nonce}.${binding}`)}`;
  }

  isValid(challenge: string | undefined, visitorId?: string): boolean {
    if (!challenge) return false;
    const [issuedAt, nonce, signature] = challenge.split('.');
    if (!issuedAt || !nonce || !signature) return false;

    const issuedAtMs = Number(issuedAt);
    const ageMs = Date.now() - issuedAtMs;
    const minimumAgeMs = this.getPositiveInteger(
      'CONTACT_CHALLENGE_MIN_AGE_MS',
      DEFAULT_MINIMUM_AGE_MS,
    );
    const maximumAgeMs = this.getPositiveInteger(
      'CONTACT_CHALLENGE_MAX_AGE_MS',
      DEFAULT_MAXIMUM_AGE_MS,
    );
    if (
      !Number.isSafeInteger(issuedAtMs) ||
      ageMs < minimumAgeMs ||
      ageMs > maximumAgeMs
    ) {
      return false;
    }

    const expected = this.sign(`${issuedAt}.${nonce}.${visitorId ?? ''}`);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private sign(value: string): string {
    const secret =
      this.configService.get<string>('CONTACT_CHALLENGE_SECRET') ||
      this.configService.get<string>('SESSION_SECRET');
    if (!secret) {
      throw new Error('Contact challenge secret is not configured');
    }
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private getPositiveInteger(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
