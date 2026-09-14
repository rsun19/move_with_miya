import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ContactEmailSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Injectable()
export class ContactEmailService {
  private readonly logger = new Logger(ContactEmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async notify(submission: ContactEmailSubmission): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const recipient = this.configService.get<string>('CONTACT_EMAIL_TO');
    if (!apiKey || !recipient) {
      this.logger.debug(
        'Skipping contact notification because Resend is not configured',
      );
      return;
    }

    const sender = this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      'Move with Miya <onboarding@resend.dev>',
    );
    if (!sender) {
      this.logger.debug(
        'Skipping contact notification because the sender is not configured',
      );
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          reply_to: submission.email,
          subject: `[Move with Miya] ${submission.subject}`,
          text: `From: ${submission.name} <${submission.email}>\n\n${submission.message}`,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.error(
          `Resend rejected contact notification (${response.status})`,
        );
      }
    } catch (error) {
      this.logger.error('Resend contact notification failed', error);
    }
  }
}
