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

  async createRegistration(classId: number, userId: string, capacity: number) {
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
            if (existing && existing.status !== 'Canceled') {
              throw new RpcError(409, 'Already registered for this class');
            }

            const registeredCount = await tx.registration.count({
              where: { classId, status: 'Registered' },
            });
            if (registeredCount >= capacity) {
              throw new RpcError(409, 'Class is full');
            }

            if (existing) {
              return tx.registration.update({
                where: { id: existing.id },
                data: { status: 'Registered', registeredAt: new Date() },
              });
            }

            return tx.registration.create({
              data: {
                classId,
                userId,
                status: 'Registered',
              },
            });
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
    return reg;
  }

  async deleteRegistrationByClassAndUser(classId: number, userId: string) {
    const reg = await this.prisma.client.registration.findFirst({
      where: { classId, userId },
    });
    if (!reg) {
      throw new RpcError(404, 'Not registered for this class');
    }
    return this.prisma.client.registration.delete({ where: { id: reg.id } });
  }

  updateRegistration(id: number, data: Record<string, unknown>) {
    return this.prisma.client.registration.update({
      where: { id },
      data,
    });
  }

  deleteRegistration(id: number) {
    return this.prisma.client.registration.delete({
      where: { id },
    });
  }

  deleteClassRegistrations(classId: number) {
    return this.prisma.client.registration.deleteMany({
      where: { classId },
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
}
