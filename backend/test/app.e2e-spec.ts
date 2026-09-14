import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AdminGuard } from './../src/common/guards/admin.guard';
import { ContactRateLimitGuard } from './../src/common/guards/contact-rate-limit.guard';
import { ContactChallengeService } from './../src/externalControllers/contact-challenge.service';
import { ContactEmailService } from './../src/externalControllers/contact-email.service';
import { ContactRateLimitService } from './../src/externalControllers/contact-rate-limit.service';
import { TurnstileService } from './../src/externalControllers/turnstile.service';
import { of } from 'rxjs';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let registrationClient: { send: jest.Mock };

  beforeEach(async () => {
    registrationClient = {
      send: jest.fn((pattern: { cmd: string }) => {
        if (pattern.cmd === 'create_contact_submission') {
          return of({ id: 1, name: 'A Person' });
        }
        if (pattern.cmd === 'mark_contact_submission_read') {
          return of({ id: 3, read: true });
        }
        if (pattern.cmd === 'get_all_registrations') return of([]);
        return of([]);
      }),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('REGISTRATION_SERVICE')
      .useValue(registrationClient)
      .overrideProvider('CLASSES_SERVICE')
      .useValue({ send: jest.fn().mockReturnValue(of([])) })
      .overrideProvider(ContactEmailService)
      .useValue({ notify: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(ContactChallengeService)
      .useValue({ isValid: jest.fn().mockReturnValue(true) })
      .overrideProvider(ContactRateLimitService)
      .useValue({
        getVisitorId: jest.fn().mockReturnValue('visitor-id'),
        applyHeaders: jest.fn(),
        consumeVerifiedSubmission: jest.fn().mockResolvedValue({
          allowed: true,
          limit: 3,
          remaining: 2,
          resetSeconds: 60,
        }),
      })
      .overrideProvider(TurnstileService)
      .useValue({ verify: jest.fn().mockResolvedValue(true) })
      .overrideGuard(ContactRateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('OK');
  });

  it('accepts a valid contact submission and returns the saved record', () => {
    return request(app.getHttpServer())
      .post('/contact')
      .send({
        name: ' A Person ',
        email: ' person@example.com ',
        subject: ' Question ',
        message: ' Hello studio ',
        turnstileToken: 'test-turnstile-token',
        contactChallenge: 'test-contact-challenge',
      })
      .set('Cookie', 'contact_visitor=visitor-id')
      .expect(201)
      .expect({ id: 1, name: 'A Person' });
  });

  it('rejects blank contact fields', () => {
    return request(app.getHttpServer())
      .post('/contact')
      .send({
        name: '   ',
        email: 'person@example.com',
        subject: 'Question',
        message: 'Hello',
        turnstileToken: 'test-turnstile-token',
        contactChallenge: 'test-contact-challenge',
      })
      .set('Cookie', 'contact_visitor=visitor-id')
      .expect(400);
  });

  it('allows an admin to update contact read state', () => {
    return request(app.getHttpServer())
      .patch('/contact/3/read')
      .send({ read: true })
      .expect(200)
      .expect({ id: 3, read: true });
  });

  it('lists all registrations through the admin endpoint', () => {
    return request(app.getHttpServer())
      .get('/registration')
      .expect(200)
      .expect([]);
  });

  afterEach(async () => {
    await app.close();
  });
});
