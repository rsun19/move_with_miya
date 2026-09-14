import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RedisService } from '../src/redis.service';
import { AppModule } from '../src/app.module';
import { ContactEmailService } from '../src/externalControllers/contact-email.service';
import { TurnstileService } from '../src/externalControllers/turnstile.service';

const testPrefix = `contact-e2e-${process.pid}-${Date.now()}`;
const sharedIp = '198.51.100.50';
const memoryRedis = new Map<string, { count: number; expiresAt: number }>();

process.env.NODE_ENV = 'test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.SESSION_SECRET = 'contact-e2e-session-secret';
process.env.CONTACT_CHALLENGE_SECRET = 'contact-e2e-challenge-secret';
process.env.CONTACT_RATE_LIMIT_PREFIX = testPrefix;
process.env.CONTACT_IP_ATTEMPT_LIMIT = '5';
process.env.CONTACT_IP_ATTEMPT_TTL_MS = '60000';
process.env.CONTACT_COOKIE_SUBMISSION_LIMIT = '2';
process.env.CONTACT_COOKIE_SUBMISSION_TTL_MS = '60000';
process.env.CONTACT_CHALLENGE_MIN_AGE_MS = '1';
process.env.CONTACT_CHALLENGE_MAX_AGE_MS = '60000';

type Agent = ReturnType<typeof request.agent>;

function createAgent(app: INestApplication): Agent {
  const httpServer = app.getHttpServer() as unknown;
  return request.agent(httpServer as App);
}

interface TestContext {
  app: INestApplication;
  module: TestingModule;
  registrationClient: { send: jest.Mock };
  emailService: { notify: jest.Mock };
  turnstileService: { verify: jest.Mock };
  redisService: {
    getClient: () => { disconnect: () => unknown };
  };
}

class InMemoryRedisService {
  private connected = true;

  getClient() {
    return {
      sendCommand: (command: string[]) => {
        if (!this.connected) throw new Error('Redis unavailable');
        const key = command[3];
        const ttlMs = Number(command[4]);
        const now = Date.now();
        const current = memoryRedis.get(key);
        if (!current || current.expiresAt <= now) {
          memoryRedis.set(key, { count: 1, expiresAt: now + ttlMs });
        } else {
          current.count += 1;
        }
        const next = memoryRedis.get(key)!;
        return Promise.resolve([
          String(next.count),
          String(Math.max(1, next.expiresAt - now)),
        ]);
      },
      disconnect: () => {
        this.connected = false;
      },
    };
  }
}

async function createTestContext(): Promise<TestContext> {
  const registrationClient = {
    send: jest.fn((_pattern: unknown, payload: Record<string, unknown>) =>
      of({
        id: 1,
        ...payload,
        createdAt: new Date().toISOString(),
      }),
    ),
  };
  const emailService = { notify: jest.fn().mockResolvedValue(undefined) };
  const turnstileService = { verify: jest.fn().mockResolvedValue(true) };
  const useRealRedis = process.env.CONTACT_E2E_USE_REAL_REDIS === 'true';
  const redisService = useRealRedis ? undefined : new InMemoryRedisService();
  const moduleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (redisService) {
    moduleBuilder.overrideProvider(RedisService).useValue(redisService);
  }
  const module = await moduleBuilder
    .overrideProvider('REGISTRATION_SERVICE')
    .useValue(registrationClient)
    .overrideProvider(ContactEmailService)
    .useValue(emailService)
    .overrideProvider(TurnstileService)
    .useValue(turnstileService)
    .compile();

  const app = module.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const appRedisService = redisService ?? module.get(RedisService);
  if (useRealRedis) await module.get(RedisService).connect();
  await app.init();

  return {
    app,
    module,
    registrationClient,
    emailService,
    turnstileService,
    redisService: appRedisService as unknown as TestContext['redisService'],
  };
}

async function waitForChallenge(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

async function getChallenge(agent: Agent): Promise<string> {
  const response = await agent.get('/contact/challenge').expect(200);
  const body = response.body as { token?: unknown };
  expect(body.token).toEqual(expect.any(String));
  expect(response.headers['set-cookie']).toEqual(
    expect.arrayContaining([expect.stringContaining('contact_visitor=')]),
  );
  await waitForChallenge();
  return body.token as string;
}

function submission(challenge: string, suffix = '') {
  return {
    name: 'A Person',
    email: `person${suffix}@example.com`,
    subject: 'Question',
    message: 'Hello studio',
    turnstileToken: 'turnstile-token',
    contactChallenge: challenge,
  };
}

function postContact(
  _app: unknown,
  agent: Agent,
  ip: string,
  body: Record<string, unknown>,
) {
  return agent.post('/contact').set('X-Forwarded-For', ip).send(body);
}

describe('Contact endpoint (e2e)', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterEach(() => {
    context.registrationClient.send.mockClear();
    context.emailService.notify.mockClear();
    context.turnstileService.verify.mockClear();
  });

  afterAll(async () => {
    await context.app.close();
  });

  it('sets a stable visitor cookie and allows a normal submission flow', async () => {
    const agent = createAgent(context.app);
    const challenge = await getChallenge(agent);
    const firstCookie = (await agent.get('/contact/challenge')).headers[
      'set-cookie'
    ];

    expect(firstCookie).toBeUndefined();
    await waitForChallenge();
    await postContact(
      context.app,
      agent,
      '198.51.100.1',
      submission(challenge),
    ).expect(201);
    expect(context.registrationClient.send).toHaveBeenCalledTimes(1);
    expect(context.emailService.notify).toHaveBeenCalledTimes(1);
  });

  it('gives separate browsers independent quotas on the same IP', async () => {
    const firstBrowser = createAgent(context.app);
    const secondBrowser = createAgent(context.app);
    const firstChallenge = await getChallenge(firstBrowser);
    const secondChallenge = await getChallenge(secondBrowser);

    await postContact(
      context.app,
      firstBrowser,
      sharedIp,
      submission(firstChallenge, '1'),
    ).expect(201);
    await postContact(
      context.app,
      firstBrowser,
      sharedIp,
      submission(firstChallenge, '2'),
    ).expect(201);
    await postContact(
      context.app,
      secondBrowser,
      sharedIp,
      submission(secondChallenge, '3'),
    ).expect(201);
    await postContact(
      context.app,
      secondBrowser,
      sharedIp,
      submission(secondChallenge, '4'),
    ).expect(201);
  });

  it('blocks one browser after its verified-submission quota is exhausted', async () => {
    const agent = createAgent(context.app);
    const challenge = await getChallenge(agent);

    await postContact(
      context.app,
      agent,
      '198.51.100.2',
      submission(challenge, '1'),
    ).expect(201);
    await postContact(
      context.app,
      agent,
      '198.51.100.2',
      submission(challenge, '2'),
    ).expect(201);
    const blocked = await postContact(
      context.app,
      agent,
      '198.51.100.2',
      submission(challenge, '3'),
    ).expect(429);

    expect(blocked.headers['retry-after']).toEqual(expect.any(String));
    expect(blocked.headers['x-ratelimit-visitor-remaining']).toBe('0');
    expect(context.registrationClient.send).toHaveBeenCalledTimes(2);
  });

  it('keeps the browser quota when the same browser changes IPs', async () => {
    const agent = createAgent(context.app);
    const challenge = await getChallenge(agent);

    await postContact(
      context.app,
      agent,
      '198.51.100.3',
      submission(challenge, '1'),
    ).expect(201);
    await postContact(
      context.app,
      agent,
      '198.51.100.4',
      submission(challenge, '2'),
    ).expect(201);
    await postContact(
      context.app,
      agent,
      '198.51.100.5',
      submission(challenge, '3'),
    ).expect(429);
  });

  it('does not spend the browser quota on invalid requests', async () => {
    const agent = createAgent(context.app);
    const challenge = await getChallenge(agent);

    await postContact(context.app, agent, '198.51.100.6', {}).expect(400);
    await postContact(
      context.app,
      agent,
      '198.51.100.6',
      submission(challenge, '1'),
    ).expect(201);
    await postContact(
      context.app,
      agent,
      '198.51.100.6',
      submission(challenge, '2'),
    ).expect(201);
    await postContact(
      context.app,
      agent,
      '198.51.100.6',
      submission(challenge, '3'),
    ).expect(429);
  });

  it('binds challenges to the browser cookie', async () => {
    const firstBrowser = createAgent(context.app);
    const secondBrowser = createAgent(context.app);
    const firstChallenge = await getChallenge(firstBrowser);
    await getChallenge(secondBrowser);

    await postContact(
      context.app,
      secondBrowser,
      '198.51.100.7',
      submission(firstChallenge),
    ).expect(400);
    expect(context.registrationClient.send).not.toHaveBeenCalled();
  });

  it('enforces the IP circuit breaker for invalid request floods', async () => {
    const agent = createAgent(context.app);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postContact(context.app, agent, '198.51.100.8', {}).expect(400);
    }
    const blocked = await postContact(
      context.app,
      agent,
      '198.51.100.8',
      {},
    ).expect(429);

    expect(blocked.headers['x-ratelimit-ip-remaining']).toBe('0');
    expect(context.registrationClient.send).not.toHaveBeenCalled();
  });

  it('shares counters across separately created Nest applications', async () => {
    const secondContext = await createTestContext();
    const firstAgent = createAgent(context.app);
    const secondAgent = createAgent(secondContext.app);

    await postContact(context.app, firstAgent, '198.51.100.9', {}).expect(400);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await postContact(
        secondContext.app,
        secondAgent,
        '198.51.100.9',
        {},
      ).expect(400);
    }
    await postContact(
      secondContext.app,
      secondAgent,
      '198.51.100.9',
      {},
    ).expect(429);

    await secondContext.app.close();
  });

  it('fails closed when Redis is unavailable', async () => {
    await context.redisService.getClient().disconnect();
    await postContact(
      context.app,
      createAgent(context.app),
      '198.51.100.10',
      {},
    ).expect(503);
  });
});
