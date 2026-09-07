import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AdminGuard } from './../src/common/guards/admin.guard';
import { ContactEmailService } from './../src/externalControllers/contact-email.service';
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
      })
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
      })
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
