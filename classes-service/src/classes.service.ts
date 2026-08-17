import { BadRequestException, Injectable } from '@nestjs/common';
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

  private parseDate(value: unknown, field: string): Date {
    if (value == null || value === '') {
      throw new BadRequestException(`${field} is required`);
    }
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is not a valid date`);
    }
    return date;
  }

  createClass(data: {
    name: string;
    teacherIds: string[];
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
        startDate: this.parseDate(data.startDate, 'startDate'),
        endDate: this.parseDate(data.endDate, 'endDate'),
        locationId: data.locationId,
        status: (data.status as ClassStatus) ?? ClassStatus.Scheduled,
        isPrivate: data.private ?? false,
      },
      include: { location: true },
    });
  }

  updateClass(id: number, data: Record<string, unknown>) {
    const updateData: Record<string, unknown> = { ...data };
    if ('startDate' in updateData) {
      updateData.startDate = this.parseDate(updateData.startDate, 'startDate');
    }
    if ('endDate' in updateData) {
      updateData.endDate = this.parseDate(updateData.endDate, 'endDate');
    }
    return this.prisma.client.yogaClass.update({
      where: { id },
      data: updateData,
      include: { location: true },
    });
  }

  deleteClass(id: number) {
    return this.prisma.client.yogaClass.delete({ where: { id } });
  }
}
