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

  private parseNonNegativeNumber(value: unknown, field: string): number {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return number;
  }

  private parsePositiveInteger(value: unknown, field: string): number {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return number;
  }

  createClass(data: {
    name: string;
    teacherIds: string[];
    capacity: number;
    cost?: string | number;
    description?: string;
    duration?: number;
    imageUrl?: string | null;
    startDate: string;
    endDate: string;
    locationId: number;
    status?: string;
    isPrivate?: boolean;
  }) {
    const startDate = this.parseDate(data.startDate, 'startDate');
    const endDate = this.parseDate(data.endDate, 'endDate');
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    const status = data.status ?? ClassStatus.Scheduled;
    if (!Object.values(ClassStatus).includes(status as ClassStatus)) {
      throw new BadRequestException('status is invalid');
    }

    return this.prisma.client.yogaClass.create({
      data: {
        name: data.name,
        teacherIds: data.teacherIds,
        capacity: this.parsePositiveInteger(data.capacity, 'capacity'),
        cost: this.parseNonNegativeNumber(data.cost ?? 0, 'cost'),
        description: data.description ?? '',
        duration: this.parsePositiveInteger(data.duration ?? 60, 'duration'),
        imageUrl: data.imageUrl ?? null,
        startDate,
        endDate,
        locationId: data.locationId,
        status: status as ClassStatus,
        isPrivate: data.isPrivate ?? false,
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
    if ('capacity' in updateData) {
      updateData.capacity = this.parsePositiveInteger(
        updateData.capacity,
        'capacity',
      );
    }
    if ('cost' in updateData) {
      updateData.cost = this.parseNonNegativeNumber(updateData.cost, 'cost');
    }
    if ('duration' in updateData) {
      updateData.duration = this.parsePositiveInteger(
        updateData.duration,
        'duration',
      );
    }
    if (
      'status' in updateData &&
      !Object.values(ClassStatus).includes(updateData.status as ClassStatus)
    ) {
      throw new BadRequestException('status is invalid');
    }
    if ('startDate' in updateData && 'endDate' in updateData) {
      if ((updateData.endDate as Date) <= (updateData.startDate as Date)) {
        throw new BadRequestException('endDate must be after startDate');
      }
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
