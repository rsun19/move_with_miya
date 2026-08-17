import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { RegistrationService } from './registration.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({ client: {} })),
}));
import { PrismaService } from './prisma/prisma.service';

describe('RegistrationService', () => {
  let service: RegistrationService;
  let prisma: {
    registration: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  const existing = {
    id: 1,
    classId: 10,
    userId: 'user-1',
    status: 'Registered',
  };

  beforeEach(async () => {
    prisma = {
      registration: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        RegistrationService,
        { provide: PrismaService, useValue: { client: prisma } },
      ],
    }).compile();

    service = module.get(RegistrationService);
  });

  it('returns counts grouped by class id', async () => {
    prisma.registration.groupBy.mockResolvedValue([
      { classId: 10, _count: { _all: 3 } },
      { classId: 11, _count: { _all: 1 } },
    ]);

    const result = await service.getRegistrationCounts([10, 11]);

    expect(prisma.registration.groupBy).toHaveBeenCalledWith({
      by: ['classId'],
      where: { classId: { in: [10, 11] } },
      _count: { _all: true },
    });
    expect(result).toEqual([
      { classId: 10, count: 3 },
      { classId: 11, count: 1 },
    ]);
  });

  it('returns an empty array for no class ids', async () => {
    await expect(service.getRegistrationCounts([])).resolves.toEqual([]);
    expect(prisma.registration.groupBy).not.toHaveBeenCalled();
  });

  it('returns all registrations for a user', async () => {
    const regs = [
      { id: 1, classId: 10, userId: 'user-1', status: 'Registered' },
      { id: 2, classId: 11, userId: 'user-1', status: 'Registered' },
    ];
    prisma.registration.findMany.mockResolvedValue(regs);

    const result = await service.findRegistrationsByUser('user-1');

    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(result).toEqual(regs);
  });

  it('creates a registration when none exists', async () => {
    prisma.registration.findFirst.mockResolvedValue(null);
    prisma.registration.create.mockResolvedValue(existing);

    const result = await service.createRegistration(10, 'user-1');

    expect(result).toEqual(existing);
    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: { classId: 10, userId: 'user-1' },
    });
    expect(prisma.registration.create).toHaveBeenCalledWith({
      data: { classId: 10, userId: 'user-1', status: 'Registered' },
    });
  });

  it('rejects duplicate registration with 409', async () => {
    prisma.registration.findFirst.mockResolvedValue(existing);

    await expect(service.createRegistration(10, 'user-1')).rejects.toThrow(
      RpcException,
    );
    await expect(
      service.createRegistration(10, 'user-1'),
    ).rejects.toMatchObject({
      message: 'Already registered for this class',
    });
  });

  it('returns the registration for a class/user pair', async () => {
    prisma.registration.findFirst.mockResolvedValue(existing);

    await expect(
      service.findRegistrationByClassAndUser(10, 'user-1'),
    ).resolves.toEqual(existing);
  });

  it('throws 404 when not registered for class/user', async () => {
    prisma.registration.findFirst.mockResolvedValue(null);

    await expect(
      service.findRegistrationByClassAndUser(10, 'user-1'),
    ).rejects.toMatchObject({
      message: 'Not registered for this class',
    });
  });

  it('deletes the registration for a class/user pair', async () => {
    prisma.registration.findFirst.mockResolvedValue(existing);
    prisma.registration.delete.mockResolvedValue(existing);

    const result = await service.deleteRegistrationByClassAndUser(10, 'user-1');

    expect(prisma.registration.delete).toHaveBeenCalledWith({
      where: { id: existing.id },
    });
    expect(result).toEqual(existing);
  });

  it('throws 404 when deleting a non-existent registration', async () => {
    prisma.registration.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteRegistrationByClassAndUser(10, 'user-1'),
    ).rejects.toMatchObject({
      message: 'Not registered for this class',
    });
  });
});
