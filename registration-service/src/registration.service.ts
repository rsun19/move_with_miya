import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  findRegistrations(classId: number) {
    return this.prisma.client.registration.findMany({
      where: { classId },
    });
  }

  async findRegistration(id: number) {
    const reg = await this.prisma.client.registration.findUnique({
      where: { id },
    });
    if (!reg) throw new NotFoundException(`Registration ${id} not found`);
    return reg;
  }

  createRegistration(classId: number, userId: string) {
    return this.prisma.client.registration.create({
      data: {
        classId,
        userId,
        status: 'Registered',
      },
    });
  }

  updateRegistration(id: number, data: Record<string, unknown>) {
    return this.prisma.client.registration.update({
      where: { id },
      data,
    });
  }

  deleteRegistration(id: number, classId: number) {
    return this.prisma.client.registration.delete({
      where: { id },
    });
  }

  deleteClassRegistrations(classId: number) {
    return this.prisma.client.registration.deleteMany({
      where: { classId },
    });
  }
}
