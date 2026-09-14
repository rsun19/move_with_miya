import { ConfigService } from '@nestjs/config';
import { ContactEmailService } from './contact-email.service';

describe('ContactEmailService', () => {
  const submission = {
    name: 'A Person',
    email: 'person@example.com',
    subject: 'Question',
    message: 'Hello studio',
  };

  afterEach(() => jest.restoreAllMocks());

  it('does not call Resend when email is not configured', async () => {
    const config = new ConfigService();
    jest.spyOn(config, 'get').mockReturnValue(undefined);
    const fetchSpy = jest.spyOn(global, 'fetch');

    await new ContactEmailService(config).notify(submission);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends a notification through Resend', async () => {
    const config = new ConfigService({
      RESEND_API_KEY: 're_test_key',
      CONTACT_EMAIL_TO: 'studio@example.com',
      RESEND_FROM_EMAIL: 'Move with Miya <hello@example.com>',
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await new ContactEmailService(config).notify(submission);

    const fetchMock = jest.mocked(global.fetch);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer re_test_key' }),
    );
    expect(options.body).toContain('studio@example.com');
  });

  it('does not call Resend when the configured sender is empty', async () => {
    const config = new ConfigService({
      RESEND_API_KEY: 're_test_key',
      CONTACT_EMAIL_TO: 'studio@example.com',
      RESEND_FROM_EMAIL: '',
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    await new ContactEmailService(config).notify(submission);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('swallows provider failures after the submission is saved', async () => {
    const config = new ConfigService({
      RESEND_API_KEY: 're_test_key',
      CONTACT_EMAIL_TO: 'studio@example.com',
    });
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    await expect(
      new ContactEmailService(config).notify(submission),
    ).resolves.toBeUndefined();
  });
});
