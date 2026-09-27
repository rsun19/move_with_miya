import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma/prisma.service';

class RpcError extends RpcException {
  constructor(statusCode: number, message: string) {
    super({ statusCode, message });
  }
}

const ACTIVE_PAYMENT_STATUSES = ['Pending', 'Paid'] as const;

function assertPaymentInput(amountCents: number, currency: string) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RpcError(400, 'Payment amount is invalid');
  }
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new RpcError(400, 'Payment currency is invalid');
  }
}

function assertRefundPercentage(percentage: number) {
  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
    throw new RpcError(
      400,
      'Refund percentage must be an integer from 0 to 100',
    );
  }
}

/** Automatic refund retries stop after this many failures. */
export const MAX_REFUND_ATTEMPTS = 10;

/** Failed refunds the retry sweep has given up on; an admin must act. */
export const REFUND_NEEDS_ATTENTION_WHERE = {
  refundStatus: 'Failed' as const,
  refundAttempts: { gte: MAX_REFUND_ATTEMPTS },
};

/** Exponential backoff between refund retries: 2, 4, … 256 minutes. */
function refundRetryDelayMs(attempts: number) {
  return 2 ** Math.min(attempts, 8) * 60_000;
}

/** Payment fields that request a refund of `percentage` of the amount paid. */
function refundRequest(amountCents: number, percentage: number) {
  const refundAmountCents = Math.floor((amountCents * percentage) / 100);
  return {
    refundPercentage: percentage,
    refundAmountCents,
    refundRequestedAt: new Date(),
    refundStatus:
      refundAmountCents > 0 ? ('Pending' as const) : ('NotEligible' as const),
    refundError: null,
    // A new request is retried immediately with a fresh attempt budget.
    refundAttempts: 0,
    refundAvailableAt: new Date(),
  };
}

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  private addOutboxEvent(
    tx: {
      outboxEvent: {
        create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
      };
    },
    registration: { id: number; classId: number; userId: string },
    eventType: string,
    eventKey: string,
    extra: Record<string, unknown> = {},
  ) {
    return tx.outboxEvent.create({
      data: {
        eventKey,
        eventType,
        aggregateId: String(registration.id),
        payload: {
          registrationId: registration.id,
          classId: registration.classId,
          userId: registration.userId,
          ...extra,
        },
      },
    });
  }

  findRegistrations(classId: number) {
    return this.prisma.client.registration.findMany({
      where: { classId },
    });
  }

  findRegistrationsByUser(userId: string) {
    return this.prisma.client.registration.findMany({
      where: { userId },
    });
  }

  findAllRegistrations() {
    return this.prisma.client.registration.findMany({
      orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
    });
  }

  async getRegistrationCounts(classIds: number[]) {
    if (classIds.length === 0) return [];
    const grouped = await this.prisma.client.registration.groupBy({
      by: ['classId'],
      where: { classId: { in: classIds }, status: 'Registered' },
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      classId: g.classId,
      count: g._count._all,
    }));
  }

  async findRegistration(id: number) {
    const reg = await this.prisma.client.registration.findUnique({
      where: { id },
    });
    if (!reg) throw new RpcError(404, `Registration ${id} not found`);
    return reg;
  }

  async getClassPaymentAvailability(classId: number, capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RpcError(400, 'Class capacity is invalid');
    }
    const now = new Date();
    const [registered, pending] = await Promise.all([
      this.prisma.client.registration.count({
        where: { classId, status: 'Registered' },
      }),
      this.prisma.client.payment.count({
        where: { classId, status: 'Pending', expiresAt: { gt: now } },
      }),
    ]);
    return {
      classId,
      capacity,
      registered,
      pending,
      available: Math.max(0, capacity - registered - pending),
    };
  }

  async createOrGetPendingPayment(data: {
    userId: string;
    classId: number;
    capacity: number;
    amountCents: number;
    currency: string;
    expiresAt: string | Date;
  }) {
    assertPaymentInput(data.amountCents, data.currency);
    if (!data.userId || !Number.isInteger(data.classId) || data.classId <= 0) {
      throw new RpcError(400, 'Payment owner or class is invalid');
    }
    const expiresAt = new Date(data.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new RpcError(400, 'Payment expiration is invalid');
    }

    return this.runSerializable(async (tx) => {
      const existingRegistration = await tx.registration.findFirst({
        where: { classId: data.classId, userId: data.userId },
      });
      if (existingRegistration?.status === 'Registered') {
        throw new RpcError(409, 'Already registered for this class');
      }
      const existing = await tx.payment.findFirst({
        where: {
          userId: data.userId,
          classId: data.classId,
          status: { in: [...ACTIVE_PAYMENT_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing?.status === 'Paid') return existing;
      if (
        existing?.status === 'Pending' &&
        existing.expiresAt > new Date() &&
        existing.amountCents === data.amountCents &&
        existing.currency === data.currency
      ) {
        return existing;
      }
      if (existing) {
        await tx.payment.update({
          where: { id: existing.id },
          data: { status: 'Expired' },
        });
      }

      const [registered, pending] = await Promise.all([
        tx.registration.count({
          where: { classId: data.classId, status: 'Registered' },
        }),
        tx.payment.count({
          where: {
            classId: data.classId,
            status: 'Pending',
            expiresAt: { gt: new Date() },
          },
        }),
      ]);
      if (registered + pending >= data.capacity) {
        throw new RpcError(409, 'Class is full');
      }
      return tx.payment.create({
        data: {
          userId: data.userId,
          classId: data.classId,
          amountCents: data.amountCents,
          currency: data.currency,
          expiresAt,
        },
      });
    });
  }

  async attachCheckoutSession(data: {
    paymentId: string;
    stripeCheckoutSessionId: string;
  }) {
    if (!data.paymentId || !data.stripeCheckoutSessionId) {
      throw new RpcError(400, 'Payment and Checkout session are required');
    }
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: data.paymentId },
    });
    if (!payment) throw new RpcError(404, 'Payment not found');
    if (
      payment.stripeCheckoutSessionId &&
      payment.stripeCheckoutSessionId !== data.stripeCheckoutSessionId
    ) {
      throw new RpcError(409, 'Payment already has a Checkout session');
    }
    return this.prisma.client.payment.update({
      where: { id: data.paymentId },
      data: { stripeCheckoutSessionId: data.stripeCheckoutSessionId },
    });
  }

  getPaymentById(id: string) {
    return this.prisma.client.payment.findUnique({ where: { id } });
  }

  getPaymentByCheckoutSession(stripeCheckoutSessionId: string) {
    return this.prisma.client.payment.findUnique({
      where: { stripeCheckoutSessionId },
    });
  }

  getPaymentByPaymentIntent(paymentIntentId: string) {
    return this.prisma.client.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
  }

  async getPaymentStatusForUser(
    stripeCheckoutSessionId: string,
    userId: string,
  ) {
    const payment = await this.prisma.client.payment.findUnique({
      where: { stripeCheckoutSessionId },
    });
    if (!payment || payment.userId !== userId) {
      throw new RpcError(404, 'Payment not found');
    }
    const registration = payment.registrationId
      ? await this.prisma.client.registration.findUnique({
          where: { id: payment.registrationId },
        })
      : null;
    return {
      payment: {
        id: payment.id,
        classId: payment.classId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: payment.status,
        refundStatus: payment.refundStatus,
        refundPercentage: payment.refundPercentage,
        refundAmountCents: payment.refundAmountCents,
      },
      registration: registration
        ? { id: registration.id, status: registration.status }
        : null,
    };
  }

  async finalizePaidRegistration(data: {
    paymentId: string;
    checkoutSessionId: string;
    paymentIntentId?: string | null;
    amountCents: number;
    currency: string;
    capacity: number;
    classStatus: string;
    classEndAt: string;
  }) {
    assertPaymentInput(data.amountCents, data.currency);
    if (!Number.isInteger(data.capacity) || data.capacity <= 0) {
      throw new RpcError(400, 'Class capacity is invalid');
    }
    if (
      !data.classStatus ||
      Number.isNaN(new Date(data.classEndAt).getTime())
    ) {
      throw new RpcError(400, 'Class lifecycle data is invalid');
    }
    return this.runSerializable(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: data.paymentId },
      });
      if (!payment) throw new RpcError(404, 'Payment not found');
      if (
        payment.stripeCheckoutSessionId !== data.checkoutSessionId ||
        payment.amountCents !== data.amountCents ||
        payment.currency !== data.currency ||
        (data.paymentIntentId &&
          payment.stripePaymentIntentId &&
          payment.stripePaymentIntentId !== data.paymentIntentId)
      ) {
        throw new RpcError(400, 'Stripe payment details do not match');
      }

      // Marks the payment as paid and queues a full refund because no seat
      // can be granted for it.
      const markPaidForFullRefund = (registrationId?: number) =>
        tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'Paid',
            stripePaymentIntentId:
              data.paymentIntentId ?? payment.stripePaymentIntentId,
            paidAt: payment.paidAt ?? new Date(),
            registrationId,
            ...refundRequest(payment.amountCents, 100),
          },
        });

      const classUnavailable =
        data.classStatus === 'Canceled' ||
        data.classStatus === 'Completed' ||
        new Date(data.classEndAt).getTime() <= Date.now();
      if (classUnavailable) {
        if (
          payment.status === 'Refunded' ||
          payment.refundStatus === 'Succeeded'
        ) {
          return { payment, registration: null, needsRefund: false };
        }
        // A replayed webhook must not overwrite a refund that was already
        // requested (possibly for a partial amount).
        if (payment.status === 'Paid' && payment.refundStatus !== 'None') {
          return {
            payment,
            registration: null,
            needsRefund:
              payment.refundStatus === 'Pending' ||
              payment.refundStatus === 'Failed',
          };
        }
        return {
          payment: await markPaidForFullRefund(),
          registration: null,
          needsRefund: true,
        };
      }

      if (payment.status === 'Paid' && payment.registrationId) {
        const registration = await tx.registration.findUnique({
          where: { id: payment.registrationId },
        });
        return { payment, registration, needsRefund: false };
      }
      if (payment.status !== 'Pending') {
        const updatedPayment =
          payment.status === 'Expired' || payment.status === 'Failed'
            ? await markPaidForFullRefund()
            : data.paymentIntentId && !payment.stripePaymentIntentId
              ? await tx.payment.update({
                  where: { id: payment.id },
                  data: { stripePaymentIntentId: data.paymentIntentId },
                })
              : payment;
        return {
          payment: updatedPayment,
          registration: null,
          needsRefund: updatedPayment.status !== 'Refunded',
        };
      }

      const existing = await tx.registration.findFirst({
        where: { classId: payment.classId, userId: payment.userId },
      });
      if (existing?.status === 'Registered') {
        return {
          payment: await markPaidForFullRefund(existing.id),
          registration: existing,
          needsRefund: true,
        };
      }
      const registeredCount = await tx.registration.count({
        where: { classId: payment.classId, status: 'Registered' },
      });
      if (registeredCount >= data.capacity) {
        return {
          payment: await markPaidForFullRefund(),
          registration: null,
          needsRefund: true,
        };
      }

      const now = new Date();
      const registration = existing
        ? await tx.registration.update({
            where: { id: existing.id },
            data: {
              status: 'Registered',
              registeredAt: now,
              canceledAt: null,
              waitlistedAt: null,
              promotedAt: null,
              cancellationReason: null,
              source: 'stripe-webhook',
            },
          })
        : await tx.registration.create({
            data: {
              classId: payment.classId,
              userId: payment.userId,
              status: 'Registered',
              source: 'stripe-webhook',
            },
          });
      const paidPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'Paid',
          stripePaymentIntentId: data.paymentIntentId ?? undefined,
          paidAt: new Date(),
          registrationId: registration.id,
        },
      });
      await this.addOutboxEvent(
        tx,
        registration,
        'registration.confirmed',
        `registration:${registration.id}:paid:${payment.id}`,
        { paymentId: payment.id },
      );
      return { payment: paidPayment, registration, needsRefund: false };
    });
  }

  markPaymentFailed(id: string, error?: string) {
    return this.prisma.client.payment.updateMany({
      where: { id, status: 'Pending' },
      data: {
        refundError: error?.slice(0, 500),
        status: 'Failed',
      },
    });
  }

  markPaymentExpired(id: string) {
    return this.prisma.client.payment.updateMany({
      where: { id, status: 'Pending' },
      data: { status: 'Expired' },
    });
  }

  async beginPaymentRefund(data: { paymentId: string; percentage: number }) {
    assertRefundPercentage(data.percentage);
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: data.paymentId },
    });
    if (!payment) throw new RpcError(404, 'Payment not found');
    if (payment.status !== 'Paid') {
      throw new RpcError(409, 'Only paid payments can be refunded');
    }
    if (payment.refundStatus === 'Succeeded') return payment;
    if (
      payment.refundStatus === 'Pending' &&
      payment.refundPercentage !== data.percentage
    ) {
      throw new RpcError(409, 'A different refund is already in progress');
    }
    return this.prisma.client.payment.update({
      where: { id: payment.id },
      data: refundRequest(payment.amountCents, data.percentage),
    });
  }

  async beginClassRefunds(classId: number) {
    const payments = await this.prisma.client.payment.findMany({
      where: { classId, status: 'Paid', refundStatus: 'None' },
    });
    const result: unknown[] = [];
    for (const payment of payments) {
      result.push(
        await this.beginPaymentRefund({
          paymentId: payment.id,
          percentage: 100,
        }),
      );
    }
    return result;
  }

  async completePaymentRefund(data: {
    paymentId: string;
    stripeRefundId?: string;
    amountCents: number;
  }) {
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: data.paymentId },
    });
    if (!payment) throw new RpcError(404, 'Payment not found');
    if (payment.refundAmountCents !== data.amountCents) {
      throw new RpcError(409, 'Stripe refund amount does not match payment');
    }
    if (
      payment.stripeRefundId &&
      data.stripeRefundId &&
      payment.stripeRefundId !== data.stripeRefundId
    ) {
      throw new RpcError(409, 'Stripe refund does not match payment');
    }
    return this.prisma.client.payment.update({
      where: { id: data.paymentId },
      data: {
        status: 'Refunded',
        refundStatus: 'Succeeded',
        stripeRefundId: data.stripeRefundId ?? payment.stripeRefundId,
        refundedAt: new Date(),
        refundError: null,
      },
    });
  }

  recordPaymentRefund(paymentId: string, stripeRefundId: string) {
    return this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        stripeRefundId,
        // Stripe is still processing it; the refund webhook normally
        // completes it first, so only re-check occasionally.
        refundAvailableAt: new Date(Date.now() + 60 * 60_000),
      },
    });
  }

  async failPaymentRefund(paymentId: string, error: string) {
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: paymentId },
      select: { refundAttempts: true },
    });
    if (!payment) throw new RpcError(404, 'Payment not found');
    const refundAttempts = payment.refundAttempts + 1;
    return this.prisma.client.payment.update({
      where: { id: paymentId },
      data: {
        refundStatus: 'Failed',
        refundError: error.slice(0, 500),
        refundAttempts,
        refundAvailableAt: new Date(
          Date.now() + refundRetryDelayMs(refundAttempts),
        ),
      },
    });
  }

  listRefundPendingPayments() {
    return this.prisma.client.payment.findMany({
      where: {
        refundStatus: { in: ['Pending', 'Failed'] },
        refundAvailableAt: { lte: new Date() },
        refundAttempts: { lt: MAX_REFUND_ATTEMPTS },
      },
      orderBy: { refundAvailableAt: 'asc' },
      take: 100,
    });
  }

  async getAllPayments() {
    const payments = await this.prisma.client.payment.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    return payments.map((payment) => ({
      ...payment,
      refundNeedsAttention:
        payment.refundStatus === REFUND_NEEDS_ATTENTION_WHERE.refundStatus &&
        payment.refundAttempts >= MAX_REFUND_ATTEMPTS,
    }));
  }

  async recordStripeWebhookEvent(data: {
    stripeEventId: string;
    eventType: string;
  }) {
    try {
      const event = await this.prisma.client.stripeWebhookEvent.create({
        data: { stripeEventId: data.stripeEventId, eventType: data.eventType },
      });
      return { claimed: true, event };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const event = await this.prisma.client.stripeWebhookEvent.findUnique({
        where: { stripeEventId: data.stripeEventId },
      });
      return { claimed: event?.status !== 'Processed', event };
    }
  }

  completeStripeWebhookEvent(stripeEventId: string) {
    return this.prisma.client.stripeWebhookEvent.update({
      where: { stripeEventId },
      data: { status: 'Processed', processedAt: new Date(), error: null },
    });
  }

  failStripeWebhookEvent(stripeEventId: string, error: string) {
    return this.prisma.client.stripeWebhookEvent.update({
      where: { stripeEventId },
      data: { status: 'Failed', error: error.slice(0, 500) },
    });
  }

  async createRegistration(
    classId: number,
    userId: string,
    capacity: number,
    options: {
      waitlistEnabled?: boolean;
      source?: string;
    } = {},
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RpcError(400, 'Class capacity is invalid');
    }
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.client.$transaction(
          async (tx) => {
            const existing = await tx.registration.findFirst({
              where: { classId, userId },
            });
            if (existing?.status === 'Registered') {
              throw new RpcError(409, 'Already registered for this class');
            }
            if (existing?.status === 'Waitlisted') {
              throw new RpcError(409, 'Already waitlisted for this class');
            }

            const registeredCount = await tx.registration.count({
              where: { classId, status: 'Registered' },
            });
            const registered = registeredCount < capacity;
            if (!registered && options.waitlistEnabled === false) {
              throw new RpcError(409, 'Class is full');
            }
            const now = new Date();
            const status = registered ? 'Registered' : 'Waitlisted';

            if (existing) {
              const result = await tx.registration.update({
                where: { id: existing.id },
                data: {
                  status,
                  registeredAt: registered ? now : existing.registeredAt,
                  waitlistedAt: registered ? null : now,
                  promotedAt: null,
                  canceledAt: null,
                  cancellationReason: null,
                  source: options.source ?? 'member',
                },
              });
              await this.addOutboxEvent(
                tx,
                result,
                registered
                  ? 'registration.confirmed'
                  : 'registration.waitlisted',
                `registration:${result.id}:${status}:${now.toISOString()}`,
              );
              return result;
            }

            const result = await tx.registration.create({
              data: {
                classId,
                userId,
                status,
                waitlistedAt: registered ? null : now,
                source: options.source ?? 'member',
              },
            });
            await this.addOutboxEvent(
              tx,
              result,
              registered ? 'registration.confirmed' : 'registration.waitlisted',
              `registration:${result.id}:${status}:${now.toISOString()}`,
            );
            return result;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'P2002') {
          throw new RpcError(409, 'Already registered for this class');
        }
        if (code !== 'P2034' || attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error('Registration transaction did not complete');
  }

  async findRegistrationByClassAndUser(classId: number, userId: string) {
    const reg = await this.prisma.client.registration.findFirst({
      where: { classId, userId },
    });
    if (!reg) {
      throw new RpcError(404, 'Not registered for this class');
    }
    if (reg.status !== 'Waitlisted') return reg;
    const ahead = await this.prisma.client.registration.count({
      where: {
        classId,
        status: 'Waitlisted',
        OR: [
          { waitlistedAt: { lt: reg.waitlistedAt ?? new Date() } },
          {
            waitlistedAt: reg.waitlistedAt,
            id: { lt: reg.id },
          },
        ],
      },
    });
    return { ...reg, waitlistPosition: ahead + 1 };
  }

  async cancelRegistrationByClassAndUser(
    classId: number,
    userId: string,
    options: {
      capacity: number;
      classStartAt?: string | Date;
      cancellationCutoffHours?: number;
      source?: string;
      reason?: string;
      refundPercentage?: number;
    },
  ) {
    return this.cancelRegistration(
      await this.findRegistrationId(classId, userId),
      options,
    );
  }

  private async findRegistrationId(classId: number, userId: string) {
    const reg = await this.prisma.client.registration.findFirst({
      where: { classId, userId },
    });
    if (!reg) throw new RpcError(404, 'Not registered for this class');
    return reg.id;
  }

  async cancelRegistration(
    id: number,
    options: {
      capacity: number;
      classStartAt?: string | Date;
      cancellationCutoffHours?: number;
      source?: string;
      reason?: string;
      refundPercentage?: number;
    },
  ) {
    if (!Number.isInteger(options.capacity) || options.capacity <= 0) {
      throw new RpcError(400, 'Class capacity is invalid');
    }
    const cutoffHours = options.cancellationCutoffHours ?? 24;
    if (!Number.isInteger(cutoffHours) || cutoffHours < 0) {
      throw new RpcError(400, 'Cancellation cutoff is invalid');
    }
    const classStart = options.classStartAt
      ? new Date(options.classStartAt).getTime()
      : undefined;
    const cutoff =
      classStart === undefined
        ? undefined
        : classStart - cutoffHours * 60 * 60 * 1000;
    if (classStart !== undefined && Number.isNaN(classStart)) {
      throw new RpcError(400, 'Class start time is invalid');
    }

    return this.runSerializable(async (tx) => {
      const current = await tx.registration.findUnique({ where: { id } });
      if (!current) throw new RpcError(404, `Registration ${id} not found`);
      if (current.status === 'Canceled') return current;
      if (
        options.source !== 'admin' &&
        cutoff !== undefined &&
        Date.now() >= cutoff
      ) {
        throw new RpcError(403, 'The cancellation window has closed');
      }

      const now = new Date();
      const result = await tx.registration.update({
        where: { id },
        data: {
          status: 'Canceled',
          canceledAt: now,
          cancellationReason: options.reason ?? 'Member cancellation',
          source: options.source ?? 'member',
        },
      });
      await this.addOutboxEvent(
        tx,
        result,
        'registration.canceled',
        `registration:${id}:canceled:${now.toISOString()}`,
      );
      if (current.status === 'Registered') {
        await this.promoteWaitlistedInTransaction(
          tx,
          current.classId,
          options.capacity,
        );
      }
      if (
        options.refundPercentage !== undefined &&
        current.status === 'Registered'
      ) {
        assertRefundPercentage(options.refundPercentage);
        const payment = await tx.payment.findFirst({
          where: {
            classId: current.classId,
            userId: current.userId,
            status: 'Paid',
            refundStatus: 'None',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: refundRequest(payment.amountCents, options.refundPercentage),
          });
          return { ...result, refundPaymentId: payment.id };
        }
      }
      return result;
    });
  }

  async cancelClassRegistrations(
    classId: number,
    reason = 'Class canceled',
    source = 'class-cancellation',
  ) {
    return this.runSerializable(async (tx) => {
      const active = await tx.registration.findMany({
        where: { classId, status: { in: ['Registered', 'Waitlisted'] } },
      });
      const now = new Date();
      for (const registration of active) {
        const result = await tx.registration.update({
          where: { id: registration.id },
          data: {
            status: 'Canceled',
            canceledAt: now,
            cancellationReason: reason,
            source,
          },
        });
        await this.addOutboxEvent(
          tx,
          result,
          'class.canceled.registration',
          `registration:${result.id}:class-canceled:${now.toISOString()}`,
          { reason },
        );
      }
      return { canceled: active.length };
    });
  }

  private async promoteWaitlistedInTransaction(
    tx: typeof this.prisma.client,
    classId: number,
    capacity: number,
  ) {
    const registeredCount = await tx.registration.count({
      where: { classId, status: 'Registered' },
    });
    const seats = Math.max(0, capacity - registeredCount);
    if (seats === 0) return [];

    const waitlisted = await tx.registration.findMany({
      where: { classId, status: 'Waitlisted' },
      orderBy: [{ waitlistedAt: 'asc' }, { id: 'asc' }],
      take: seats,
    });
    const promoted: unknown[] = [];
    for (const registration of waitlisted) {
      const now = new Date();
      const result = await tx.registration.update({
        where: { id: registration.id },
        data: {
          status: 'Registered',
          registeredAt: now,
          promotedAt: now,
          waitlistedAt: null,
        },
      });
      await this.addOutboxEvent(
        tx,
        result,
        'registration.promoted',
        `registration:${result.id}:promoted:${now.toISOString()}`,
      );
      promoted.push(result);
    }
    return promoted;
  }

  async promoteWaitlisted(classId: number, capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RpcError(400, 'Class capacity is invalid');
    }
    return this.runSerializable((tx) =>
      this.promoteWaitlistedInTransaction(tx, classId, capacity),
    );
  }

  private async runSerializable<T>(
    callback: (tx: typeof this.prisma.client) => Promise<T>,
  ) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.client.$transaction(callback, {
          isolationLevel: 'Serializable',
        });
      } catch (error) {
        if (
          (error as { code?: string }).code !== 'P2034' ||
          attempt === maxAttempts
        ) {
          throw error;
        }
      }
    }
    throw new Error('Serializable transaction did not complete');
  }

  updateRegistration(id: number, data: Record<string, unknown>) {
    if ('status' in data) {
      throw new RpcError(
        400,
        'Use the cancellation lifecycle endpoint to change status',
      );
    }
    return this.prisma.client.registration.update({
      where: { id },
      data,
    });
  }

  deleteRegistration(id: number) {
    return Promise.reject(
      new RpcError(409, `Registration ${id} must be canceled, not deleted`),
    );
  }

  deleteClassRegistrations(classId: number) {
    return Promise.reject(
      new RpcError(
        409,
        `Class ${classId} registrations must be canceled, not deleted`,
      ),
    );
  }

  deleteRegistrationByClassAndUser() {
    return Promise.reject(
      new RpcError(409, 'Registrations must be canceled, not deleted'),
    );
  }

  async getClassLifecycleSummary(classId: number) {
    const [total, active] = await Promise.all([
      this.prisma.client.registration.count({ where: { classId } }),
      this.prisma.client.registration.count({
        where: { classId, status: { in: ['Registered', 'Waitlisted'] } },
      }),
    ]);
    return { classId, total, active };
  }

  async claimNotification(eventKey: string) {
    if (!eventKey.trim())
      throw new RpcError(400, 'Notification event key is required');
    try {
      const existing = await this.prisma.client.notificationDelivery.findUnique(
        {
          where: { eventKey },
        },
      );
      if (existing?.status === 'Sent') return false;
      if (
        existing?.status === 'Processing' &&
        Date.now() - new Date(existing.updatedAt).getTime() < 5 * 60 * 1_000
      ) {
        return false;
      }
      if (existing) {
        await this.prisma.client.notificationDelivery.update({
          where: { eventKey },
          data: { status: 'Processing' },
        });
        return true;
      }
      await this.prisma.client.notificationDelivery.create({
        data: { eventKey, status: 'Processing' },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.prisma.client.notificationDelivery.findUnique(
        {
          where: { eventKey },
        },
      );
      return existing?.status !== 'Sent';
    }
  }

  completeNotification(eventKey: string) {
    return this.prisma.client.notificationDelivery.update({
      where: { eventKey },
      data: { status: 'Sent', sentAt: new Date(), lastError: null },
    });
  }

  failNotification(eventKey: string, error: string) {
    return this.prisma.client.notificationDelivery.update({
      where: { eventKey },
      data: {
        status: 'Pending',
        attempts: { increment: 1 },
        lastError: error.slice(0, 500),
      },
    });
  }

  createContactSubmission(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    return this.prisma.client.contactSubmission.create({ data });
  }

  getContactSubmissions(take: number = 50, skip: number = 0) {
    return this.prisma.client.contactSubmission.findMany({
      take,
      skip,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async markContactSubmissionRead(id: number, read: boolean) {
    try {
      return await this.prisma.client.contactSubmission.update({
        where: { id },
        data: { read },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') {
        throw new RpcError(404, `Contact submission ${id} not found`);
      }
      throw error;
    }
  }
}
