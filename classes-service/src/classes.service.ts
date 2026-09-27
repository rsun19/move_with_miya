import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ClassStatus } from './generated/prisma/client';

export interface RefundTier {
  hoursBeforeStart: number;
  percentage: number;
}

export const DEFAULT_REFUND_POLICY: RefundTier[] = [
  { hoursBeforeStart: 24, percentage: 100 },
];

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
    const raw = String(value).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    const number = Number(raw);
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

  private parseNonNegativeInteger(value: unknown, field: string): number {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(number) || number < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer`);
    }
    return number;
  }

  private parseRefundPolicy(value: unknown): RefundTier[] {
    if (value === undefined) return DEFAULT_REFUND_POLICY;
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('refundPolicy must be a non-empty array');
    }

    const tiers = value.map((tier, index) => {
      if (!tier || typeof tier !== 'object') {
        throw new BadRequestException(`refundPolicy[${index}] is invalid`);
      }
      const candidate = tier as Record<string, unknown>;
      const keys = Object.keys(candidate).sort();
      if (
        keys.length !== 2 ||
        keys[0] !== 'hoursBeforeStart' ||
        keys[1] !== 'percentage'
      ) {
        throw new BadRequestException(
          `refundPolicy[${index}] must contain only hoursBeforeStart and percentage`,
        );
      }
      const hoursBeforeStart = candidate.hoursBeforeStart;
      const percentage = candidate.percentage;
      if (
        typeof hoursBeforeStart !== 'number' ||
        !Number.isSafeInteger(hoursBeforeStart) ||
        hoursBeforeStart < 0
      ) {
        throw new BadRequestException(
          `refundPolicy[${index}].hoursBeforeStart must be a non-negative integer`,
        );
      }
      if (
        typeof percentage !== 'number' ||
        !Number.isSafeInteger(percentage) ||
        percentage < 0 ||
        percentage > 100
      ) {
        throw new BadRequestException(
          `refundPolicy[${index}].percentage must be an integer from 0 to 100`,
        );
      }
      return { hoursBeforeStart, percentage };
    });

    const thresholds = new Set(tiers.map((tier) => tier.hoursBeforeStart));
    if (thresholds.size !== tiers.length) {
      throw new BadRequestException('refundPolicy thresholds must be unique');
    }
    return tiers.sort((a, b) => b.hoursBeforeStart - a.hoursBeforeStart);
  }

  private validateRefundPolicyCutoff(
    policy: RefundTier[],
    cutoffHours: number,
  ): void {
    if (!policy.some((tier) => tier.hoursBeforeStart <= cutoffHours)) {
      throw new BadRequestException(
        'refundPolicy must include a tier applicable at the cancellation cutoff',
      );
    }
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
    waitlistEnabled?: boolean;
    cancellationCutoffHours?: number;
    refundPolicy?: unknown;
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
    if (
      data.waitlistEnabled !== undefined &&
      typeof data.waitlistEnabled !== 'boolean'
    ) {
      throw new BadRequestException('waitlistEnabled must be a boolean');
    }
    const refundPolicy = this.parseRefundPolicy(data.refundPolicy);
    const cancellationCutoffHours = this.parseNonNegativeInteger(
      data.cancellationCutoffHours ?? 24,
      'cancellationCutoffHours',
    );
    this.validateRefundPolicyCutoff(refundPolicy, cancellationCutoffHours);

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
        waitlistEnabled: data.waitlistEnabled ?? true,
        cancellationCutoffHours,
        refundPolicy: refundPolicy.map((tier) => ({
          hoursBeforeStart: tier.hoursBeforeStart,
          percentage: tier.percentage,
        })),
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
    if ('cancellationCutoffHours' in updateData) {
      updateData.cancellationCutoffHours = this.parseNonNegativeInteger(
        updateData.cancellationCutoffHours,
        'cancellationCutoffHours',
      );
    }
    if ('refundPolicy' in updateData) {
      updateData.refundPolicy = this.parseRefundPolicy(updateData.refundPolicy);
    }
    if (
      'status' in updateData &&
      !Object.values(ClassStatus).includes(updateData.status as ClassStatus)
    ) {
      throw new BadRequestException('status is invalid');
    }
    if (
      'waitlistEnabled' in updateData &&
      typeof updateData.waitlistEnabled !== 'boolean'
    ) {
      throw new BadRequestException('waitlistEnabled must be a boolean');
    }
    const needsPersistedValidation =
      'startDate' in updateData ||
      'endDate' in updateData ||
      'refundPolicy' in updateData ||
      'cancellationCutoffHours' in updateData;
    if (!needsPersistedValidation) {
      return this.prisma.client.yogaClass.update({
        where: { id },
        data: updateData,
        include: { location: true },
      });
    }

    return this.prisma.client.$transaction(
      async (tx) => {
        const persistedClass = await tx.yogaClass.findUniqueOrThrow({
          where: { id },
          select: {
            startDate: true,
            endDate: true,
            cancellationCutoffHours: true,
            refundPolicy: true,
          },
        });
        const startDate = (
          'startDate' in updateData
            ? updateData.startDate
            : persistedClass.startDate
        ) as Date;
        const endDate = (
          'endDate' in updateData ? updateData.endDate : persistedClass.endDate
        ) as Date;

        if (endDate <= startDate) {
          throw new BadRequestException('endDate must be after startDate');
        }

        if (
          'refundPolicy' in updateData ||
          'cancellationCutoffHours' in updateData
        ) {
          const refundPolicy =
            'refundPolicy' in updateData
              ? (updateData.refundPolicy as RefundTier[])
              : this.parseRefundPolicy(persistedClass.refundPolicy);
          const cutoffHours =
            'cancellationCutoffHours' in updateData
              ? (updateData.cancellationCutoffHours as number)
              : persistedClass.cancellationCutoffHours;
          this.validateRefundPolicyCutoff(refundPolicy, cutoffHours);
        }

        return tx.yogaClass.update({
          where: { id },
          data: updateData,
          include: { location: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  deleteClass(id: number) {
    return this.prisma.client.yogaClass.delete({ where: { id } });
  }
}
