import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from './prisma/prisma.service';

class RpcError extends RpcException {
  constructor(statusCode: number, message: string) {
    super({ statusCode, message });
  }
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
