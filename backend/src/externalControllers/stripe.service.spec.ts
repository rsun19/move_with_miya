import { ConflictException, ForbiddenException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('StripeService', () => {
  let service: StripeService;
  let registrationClient: { send: jest.Mock };
  let classesClient: { send: jest.Mock };
  let stripeMock: {
    checkout: { sessions: { create: jest.Mock; retrieve: jest.Mock } };
    refunds: { create: jest.Mock };
  };

  beforeEach(() => {
    registrationClient = { send: jest.fn() };
    classesClient = { send: jest.fn() };
    stripeMock = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_test',
            url: 'https://checkout.test/session',
          }),
          retrieve: jest.fn(),
        },
      },
      refunds: { create: jest.fn() },
    };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripeMock);
    process.env.PUBLIC_APP_URL = 'https://app.test';
    process.env.STRIPE_CURRENCY = 'usd';
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    service = new StripeService(
      {
        get: jest.fn(
          (key: string, fallback?: unknown) => process.env[key] ?? fallback,
        ),
      } as never,
      registrationClient as never,
      classesClient as never,
    );
  });

  afterEach(() => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.STRIPE_CURRENCY;
    delete process.env.STRIPE_SECRET_KEY;
    jest.restoreAllMocks();
  });

  it('creates a server-priced Checkout session and persists its id', async () => {
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Morning Flow',
        cost: '15.50',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ banned: false }), { status: 200 }),
      );
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'create_or_get_pending_payment'
          ? {
              id: 'payment-1',
              status: 'Pending',
              amountCents: 1550,
              currency: 'usd',
            }
          : {},
      ),
    );

    await expect(service.createCheckoutSession('user-1', 1)).resolves.toEqual({
      url: 'https://checkout.test/session',
      paymentId: 'payment-1',
    });
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: 'payment-1',
        metadata: { paymentId: 'payment-1', classId: '1', userId: 'user-1' },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 1550,
              currency: 'usd',
            }) as unknown,
          }),
        ],
      }),
      { idempotencyKey: expect.stringContaining('payment-1') as unknown },
    );
    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'attach_checkout_session' },
      { paymentId: 'payment-1', stripeCheckoutSessionId: 'cs_test' },
    );
  });

  it('leaves the payment pending and reuses its idempotency key after attachment fails', async () => {
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Morning Flow',
        cost: '15.50',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ banned: false }), { status: 200 }),
        ),
      );
    let attachmentAttempts = 0;
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) => {
      if (cmd === 'create_or_get_pending_payment') {
        return of({
          id: 'payment-1',
          status: 'Pending',
          amountCents: 1550,
          currency: 'usd',
          expiresAt: '2099-01-01T09:30:00.000Z',
        });
      }
      if (cmd === 'attach_checkout_session' && attachmentAttempts++ === 0) {
        return throwError(() => new Error('database unavailable'));
      }
      return of({});
    });

    await expect(service.createCheckoutSession('user-1', 1)).rejects.toThrow(
      'Unable to start Stripe Checkout',
    );
    await expect(service.createCheckoutSession('user-1', 1)).resolves.toEqual({
      url: 'https://checkout.test/session',
      paymentId: 'payment-1',
    });

    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(2);
    expect(stripeMock.checkout.sessions.create).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      {
        idempotencyKey: 'checkout:user-1:1:payment-1',
      },
    );
    expect(stripeMock.checkout.sessions.create).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      {
        idempotencyKey: 'checkout:user-1:1:payment-1',
      },
    );
    const expectedExpiresAt = Math.floor(
      new Date('2099-01-01T09:30:00.000Z').getTime() / 1000,
    );
    expect(stripeMock.checkout.sessions.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ expires_at: expectedExpiresAt }),
      expect.anything(),
    );
    expect(stripeMock.checkout.sessions.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ expires_at: expectedExpiresAt }),
      expect.anything(),
    );
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'mark_payment_failed' },
      expect.anything(),
    );
  });

  it('does not create a second session when the existing session is complete', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      classId: 1,
      amountCents: 1550,
      currency: 'usd',
      status: 'Pending',
      refundStatus: 'None',
      stripeCheckoutSessionId: 'cs_complete',
    };
    const cls = {
      id: 1,
      name: 'Morning Flow',
      cost: '15.50',
      capacity: 5,
      startDate: '2099-01-01T10:00:00.000Z',
      endDate: '2099-01-01T11:00:00.000Z',
      status: 'Scheduled',
    };
    classesClient.send.mockReturnValue(of(cls));
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ banned: false }), { status: 200 }),
      );
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_complete',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 1550,
      currency: 'usd',
      payment_intent: 'pi_1',
      client_reference_id: 'payment-1',
      metadata: { paymentId: 'payment-1', classId: '1', userId: 'user-1' },
    });
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'create_or_get_pending_payment'
          ? payment
          : cmd === 'get_payment_by_id'
            ? payment
            : cmd === 'finalize_paid_registration'
              ? { payment, needsRefund: false }
              : {},
      ),
    );

    await expect(service.createCheckoutSession('user-1', 1)).rejects.toThrow(
      'Payment is already being processed; check your dashboard',
    );
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'mark_payment_expired' },
      expect.anything(),
    );
    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'finalize_paid_registration' },
      expect.objectContaining({ checkoutSessionId: 'cs_complete' }),
    );
  });

  it('does not create a second session while an async payment is completing', async () => {
    const payment = {
      id: 'payment-1',
      status: 'Pending',
      amountCents: 1550,
      currency: 'usd',
      stripeCheckoutSessionId: 'cs_processing',
    };
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Morning Flow',
        cost: '15.50',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ banned: false }), { status: 200 }),
      );
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_processing',
      status: 'complete',
      payment_status: 'unpaid',
    });
    registrationClient.send.mockReturnValue(of(payment));

    await expect(service.createCheckoutSession('user-1', 1)).rejects.toThrow(
      'Payment is already being processed; check your dashboard',
    );
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'mark_payment_expired' },
      expect.anything(),
    );
  });

  it('rejects class prices with more than two decimal places', async () => {
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Invalid Price',
        cost: '10.001',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ banned: false }), { status: 200 }),
      );

    await expect(service.createCheckoutSession('user-1', 1)).rejects.toThrow(
      ConflictException,
    );
    expect(registrationClient.send).not.toHaveBeenCalled();
  });

  it('rejects checkout for a class that has already ended', async () => {
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Past Flow',
        cost: '15.00',
        capacity: 5,
        startDate: '2020-01-01T10:00:00.000Z',
        endDate: '2020-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ banned: false })));

    await expect(service.createCheckoutSession('user-1', 1)).rejects.toThrow(
      ForbiddenException,
    );
    expect(registrationClient.send).not.toHaveBeenCalled();
  });

  it('passes trusted class lifecycle data into paid finalization', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      classId: 1,
      amountCents: 1550,
      currency: 'usd',
      status: 'Pending',
      refundStatus: 'None',
      stripeCheckoutSessionId: 'cs_test',
    };
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Morning Flow',
        cost: '15.50',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'get_payment_by_id'
          ? payment
          : cmd === 'finalize_paid_registration'
            ? { payment, needsRefund: false }
            : {},
      ),
    );

    await service['handleCheckoutSuccess']({
      id: 'cs_test',
      payment_status: 'paid',
      amount_total: 1550,
      currency: 'usd',
      payment_intent: 'pi_1',
      client_reference_id: 'payment-1',
      metadata: { paymentId: 'payment-1', classId: '1', userId: 'user-1' },
    } as unknown as Stripe.Checkout.Session);

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'finalize_paid_registration' },
      expect.objectContaining({
        classStatus: 'Scheduled',
        classEndAt: '2099-01-01T11:00:00.000Z',
      }),
    );
  });

  it('attaches a missing Checkout session from a signed paid webhook before finalization', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      classId: 1,
      amountCents: 1550,
      currency: 'usd',
      status: 'Pending',
      refundStatus: 'None',
      stripeCheckoutSessionId: null,
    };
    const attachedPayment = { ...payment, stripeCheckoutSessionId: 'cs_test' };
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Morning Flow',
        cost: '15.50',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'get_payment_by_id'
          ? payment
          : cmd === 'attach_checkout_session'
            ? attachedPayment
            : cmd === 'finalize_paid_registration'
              ? { payment: attachedPayment, needsRefund: false }
              : {},
      ),
    );

    await expect(
      service['handleCheckoutSuccess']({
        id: 'cs_test',
        payment_status: 'paid',
        amount_total: 1550,
        currency: 'usd',
        payment_intent: 'pi_1',
        client_reference_id: 'payment-1',
        metadata: { paymentId: 'payment-1', classId: '1', userId: 'user-1' },
      } as unknown as Stripe.Checkout.Session),
    ).resolves.toBeUndefined();

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'attach_checkout_session' },
      { paymentId: 'payment-1', stripeCheckoutSessionId: 'cs_test' },
    );
    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'finalize_paid_registration' },
      expect.objectContaining({
        checkoutSessionId: 'cs_test',
        amountCents: 1550,
        currency: 'usd',
        paymentIntentId: 'pi_1',
      }),
    );
  });

  it('rejects a paid webhook whose session conflicts with the stored session', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      classId: 1,
      stripeCheckoutSessionId: 'cs_stored',
    };
    registrationClient.send.mockReturnValue(of(payment));

    await expect(
      service['handleCheckoutSuccess']({
        id: 'cs_other',
        payment_status: 'paid',
        amount_total: 1550,
        currency: 'usd',
        metadata: { paymentId: 'payment-1', classId: '1', userId: 'user-1' },
      } as unknown as Stripe.Checkout.Session),
    ).rejects.toThrow('Stripe Checkout session does not match payment');
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'attach_checkout_session' },
      expect.anything(),
    );
  });

  it('replaces a Checkout session only after Stripe confirms expiration', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      classId: 1,
      amountCents: 1550,
      currency: 'usd',
      status: 'Pending',
      refundStatus: 'None',
      stripeCheckoutSessionId: 'cs_expired',
    };
    const replacement = {
      ...payment,
      id: 'payment-2',
      stripeCheckoutSessionId: null,
    };
    classesClient.send.mockReturnValue(
      of({
        id: 1,
        name: 'Morning Flow',
        cost: '15.50',
        capacity: 5,
        startDate: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T11:00:00.000Z',
        status: 'Scheduled',
      }),
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ banned: false }), { status: 200 }),
      );
    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_expired',
      status: 'expired',
      payment_status: 'unpaid',
    });
    let paymentLookupCount = 0;
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) => {
      if (cmd === 'create_or_get_pending_payment') {
        return of(paymentLookupCount++ === 0 ? payment : replacement);
      }
      return of({});
    });

    await expect(service.createCheckoutSession('user-1', 1)).resolves.toEqual({
      url: 'https://checkout.test/session',
      paymentId: 'payment-2',
    });
    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'mark_payment_expired' },
      { id: 'payment-1' },
    );
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('ignores already-claimed webhook events', async () => {
    registrationClient.send.mockReturnValue(of({ claimed: false }));

    await expect(
      service.handleWebhook({
        id: 'evt_1',
        type: 'checkout.session.completed',
      } as Stripe.Event),
    ).resolves.toBeUndefined();
    expect(registrationClient.send).toHaveBeenCalledTimes(1);
  });

  it('marks failed Checkout events and completes their webhook record', async () => {
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(cmd === 'record_stripe_webhook_event' ? { claimed: true } : {}),
    );

    await service.handleWebhook({
      id: 'evt_failed',
      type: 'checkout.session.async_payment_failed',
      data: {
        object: {
          metadata: { paymentId: 'payment-1' },
          client_reference_id: null,
        },
      },
    } as unknown as Stripe.Event);

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'mark_payment_failed' },
      { id: 'payment-1' },
    );
    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'complete_stripe_webhook_event' },
      { stripeEventId: 'evt_failed' },
    );
  });

  it('does not call Stripe for a zero-amount refund', async () => {
    registrationClient.send.mockReturnValue(
      of({ id: 'payment-1', refundStatus: 'NotEligible' }),
    );

    await expect(service.refundPayment('payment-1')).resolves.toEqual(
      expect.objectContaining({ refundStatus: 'NotEligible' }),
    );
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
  });

  it('does not complete a refund when Stripe reports the wrong amount', async () => {
    const payment = {
      id: 'payment-1',
      refundAmountCents: 1500,
      refundStatus: 'Pending',
      stripeRefundId: 're_expected',
    };
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'get_payment_by_payment_intent'
          ? payment
          : cmd === 'fail_payment_refund'
            ? {}
            : undefined,
      ),
    );

    await service['handleRefundEvent']({
      object: 'refund',
      id: 're_expected',
      status: 'succeeded',
      amount: 1400,
      payment_intent: 'pi_1',
    } as unknown as Stripe.Refund);

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'fail_payment_refund' },
      expect.objectContaining({ paymentId: 'payment-1' }),
    );
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'complete_payment_refund' },
      expect.anything(),
    );
  });

  it('leaves locally pending refunds pending until Stripe succeeds', async () => {
    const payment = {
      id: 'payment-1',
      amountCents: 2500,
      refundAmountCents: 1250,
      refundStatus: 'None',
      stripePaymentIntentId: 'pi_1',
    };
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'get_payment_by_id'
          ? payment
          : cmd === 'begin_payment_refund'
            ? { ...payment, refundStatus: 'Pending', refundPercentage: 50 }
            : {},
      ),
    );
    stripeMock.refunds.create.mockResolvedValue({
      id: 're_pending',
      amount: 1250,
      status: 'pending',
    });

    await service.refundPayment('payment-1', 50);

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'record_payment_refund' },
      { paymentId: 'payment-1', stripeRefundId: 're_pending' },
    );
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'complete_payment_refund' },
      expect.anything(),
    );
  });

  it('completes a locally pending refund only with the exact Stripe amount', async () => {
    const payment = {
      id: 'payment-1',
      amountCents: 2500,
      refundAmountCents: 2500,
      refundStatus: 'None',
      stripePaymentIntentId: 'pi_1',
    };
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'get_payment_by_id'
          ? payment
          : cmd === 'begin_payment_refund'
            ? { ...payment, refundStatus: 'Pending', refundPercentage: 100 }
            : {},
      ),
    );
    stripeMock.refunds.create.mockResolvedValue({
      id: 're_succeeded',
      amount: 2500,
      status: 'succeeded',
    });

    await service.refundPayment('payment-1', 100);

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'complete_payment_refund' },
      {
        paymentId: 'payment-1',
        stripeRefundId: 're_succeeded',
        amountCents: 2500,
      },
    );
  });

  it('records the actual amount for an externally initiated refund', async () => {
    const payment = {
      id: 'payment-1',
      refundAmountCents: null,
      refundStatus: 'None',
      stripeRefundId: null,
    };
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      of(
        cmd === 'get_payment_by_payment_intent'
          ? payment
          : cmd === 'complete_payment_refund'
            ? {}
            : undefined,
      ),
    );

    await service['handleRefundEvent']({
      object: 'refund',
      id: 're_external',
      status: 'succeeded',
      amount: 900,
      payment_intent: 'pi_1',
    } as unknown as Stripe.Refund);

    expect(registrationClient.send).toHaveBeenCalledWith(
      { cmd: 'complete_payment_refund' },
      {
        paymentId: 'payment-1',
        stripeRefundId: 're_external',
        amountCents: 900,
      },
    );
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'fail_payment_refund' },
      expect.anything(),
    );
  });

  it('does not mark a refund failed when post-Stripe bookkeeping fails', async () => {
    const payment = {
      id: 'payment-1',
      refundAmountCents: 1000,
      refundStatus: 'Pending',
      stripePaymentIntentId: 'pi_1',
    };
    registrationClient.send.mockImplementation(({ cmd }: { cmd: string }) =>
      cmd === 'complete_payment_refund'
        ? throwError(() => new ConflictException('stale refund state'))
        : of(cmd === 'get_payment_by_id' ? payment : { ...payment }),
    );
    stripeMock.refunds.create.mockResolvedValue({
      id: 're_succeeded',
      amount: 1000,
      status: 'succeeded',
    });

    await expect(service.refundPayment('payment-1')).rejects.toThrow(
      'stale refund state',
    );
    expect(registrationClient.send).not.toHaveBeenCalledWith(
      { cmd: 'fail_payment_refund' },
      expect.anything(),
    );
  });
});
