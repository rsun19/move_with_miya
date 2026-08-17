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
      where: { classId: { in: classIds } },
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

  async createRegistration(classId: number, userId: string) {
    const existing = await this.prisma.client.registration.findFirst({
      where: { classId, userId },
    });
    if (existing) {
      throw new RpcError(409, 'Already registered for this class');
    }
    return this.prisma.client.registration.create({
      data: {
        classId,
        userId,
        status: 'Registered',
      },
    });
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
