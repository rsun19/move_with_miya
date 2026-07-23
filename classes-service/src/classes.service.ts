import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ClassStatus } from './generated/prisma/client';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  findClasses() {
    return this.prisma.client.yogaClass.findMany({
      include: { location: true },
    });
  }

  findClassesInRange(startDate: string, endDate: string) {
    return this.prisma.client.yogaClass.findMany({
      where: {
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
      },
      include: { location: true },
    });
  }

  findClass(id: number) {
    return this.prisma.client.yogaClass.findUnique({
      where: { id },
      include: { location: true },
    });
  }

  createClass(data: {
    name: string;
    teacherIds: number[];
    capacity: number;
    startDate: string;
    endDate: string;
    locationId: number;
    status?: string;
    private?: boolean;
  }) {
    return this.prisma.client.yogaClass.create({
      data: {
        name: data.name,
        teacherIds: data.teacherIds,
        capacity: data.capacity,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        locationId: data.locationId,
        status: (data.status as ClassStatus) ?? ClassStatus.Scheduled,
        isPrivate: data.private ?? false,
      },
      include: { location: true },
    });
  }

  updateClass(id: number, data: Record<string, unknown>) {
    return this.prisma.client.yogaClass.update({
      where: { id },
      data,
      include: { location: true },
    });
  }

  deleteClass(id: number) {
    return this.prisma.client.yogaClass.delete({ where: { id } });
  }
}
