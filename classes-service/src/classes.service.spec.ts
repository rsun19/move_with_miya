import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClassesService } from './classes.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({ client: {} })),
}));
jest.mock('./generated/prisma/client', () => ({
  ClassStatus: { Scheduled: 'Scheduled' },
}));
import { PrismaService } from './prisma/prisma.service';

describe('ClassesService date validation', () => {
  let service: ClassesService;
  let prisma: {
    yogaClass: {
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      yogaClass: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: PrismaService, useValue: { client: prisma } },
      ],
    }).compile();

    service = module.get(ClassesService);
  });

  describe('createClass', () => {
    const base = {
      name: 'Vinyasa',
      teacherIds: ['user-1'],
      capacity: 10,
      startDate: '2026-09-01T10:00:00.000Z',
      endDate: '2026-09-01T11:00:00.000Z',
      locationId: 1,
    };

    it('creates a class with valid dates', async () => {
      prisma.yogaClass.create.mockResolvedValue({ id: 1 });
      const result = await service.createClass(base);
      expect(result).toEqual({ id: 1 });
      expect(prisma.yogaClass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: expect.any(Date) as never,
            endDate: expect.any(Date) as never,
          }) as never,
        }) as never,
      );
    });

    it('rejects a missing startDate', () => {
      expect(() => service.createClass({ ...base, startDate: '' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects an invalid startDate', () => {
      expect(() =>
        service.createClass({ ...base, startDate: 'not-a-date' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('updateClass', () => {
    it('passes through updates without date fields untouched', async () => {
      prisma.yogaClass.update.mockResolvedValue({ id: 1 });
      await service.updateClass(1, { name: 'Updated' });
      expect(prisma.yogaClass.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated' },
        include: { location: true },
      });
    });

    it('converts a valid startDate to a Date', async () => {
      prisma.yogaClass.update.mockResolvedValue({ id: 1 });
      await service.updateClass(1, { startDate: '2026-09-01T10:00:00.000Z' });
      expect(prisma.yogaClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: expect.any(Date) as never,
          }) as never,
        }) as never,
      );
    });

    it('rejects an invalid startDate', () => {
      expect(() => service.updateClass(1, { startDate: 'nope' })).toThrow(
        BadRequestException,
      );
    });
  });
});
