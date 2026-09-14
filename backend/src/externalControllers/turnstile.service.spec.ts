import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('validates the token, action, and optional hostname with Cloudflare', async () => {
    const config = new ConfigService({
      TURNSTILE_SECRET_KEY: 'secret',
      TURNSTILE_ACTION: 'contact',
      TURNSTILE_HOSTNAME: 'example.com',
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          action: 'contact',
          hostname: 'example.com',
        }),
        { status: 200 },
      ),
    );

    await expect(
      new TurnstileService(config).verify('token', '198.51.100.10'),
    ).resolves.toBe(true);
    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      options,
    );
    expect(options.method).toBe('POST');
    expect(options.body).toContain('"response":"token"');
  });

  it('rejects a failed Cloudflare verification', async () => {
    const config = new ConfigService({ TURNSTILE_SECRET_KEY: 'secret' });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      );

    await expect(new TurnstileService(config).verify('token')).resolves.toBe(
      false,
    );
  });
});
