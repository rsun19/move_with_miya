import { ConfigService } from '@nestjs/config';
import { ContactChallengeService } from './contact-challenge.service';

describe('ContactChallengeService', () => {
  afterEach(() => jest.useRealTimers());

  it('accepts a signed challenge after the minimum delay', () => {
    jest.useFakeTimers();
    const config = new ConfigService({ SESSION_SECRET: 'test-secret' });
    const service = new ContactChallengeService(config);
    const challenge = service.issue('visitor-a');

    expect(service.isValid(challenge, 'visitor-a')).toBe(false);
    jest.advanceTimersByTime(3_000);
    expect(service.isValid(challenge, 'visitor-a')).toBe(true);
    expect(service.isValid(challenge, 'visitor-b')).toBe(false);
  });

  it('rejects tampered and expired challenges', () => {
    jest.useFakeTimers();
    const config = new ConfigService({ SESSION_SECRET: 'test-secret' });
    const service = new ContactChallengeService(config);
    const challenge = service.issue('visitor-a');

    jest.advanceTimersByTime(3_000);
    expect(service.isValid(`${challenge}x`, 'visitor-a')).toBe(false);
    expect(service.isValid(challenge, 'visitor-b')).toBe(false);
    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(service.isValid(challenge, 'visitor-a')).toBe(false);
  });
});
