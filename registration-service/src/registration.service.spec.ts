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
      count: jest.Mock;
    };
    $transaction: jest.Mock;
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
        count: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
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
      where: { classId: { in: [10, 11] }, status: 'Registered' },
      _count: { _all: true },
    });
    expect(result).toEqual([
      { classId: 10, count: 3 },
      { classId: 11, count: 1 },
    ]);
  });

  it('returns registrations for a class', async () => {
    prisma.registration.findMany.mockResolvedValue([existing]);

    await expect(service.findRegistrations(10)).resolves.toEqual([existing]);
    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { classId: 10 },
    });
  });

  it('throws when a registration id does not exist', async () => {
    prisma.registration.findUnique.mockResolvedValue(null);

    await expect(service.findRegistration(99)).rejects.toMatchObject({
      message: 'Registration 99 not found',
    });
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

    const result = await service.createRegistration(10, 'user-1', 10);

    expect(result).toEqual(existing);
    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: { classId: 10, userId: 'user-1' },
    });
    expect(prisma.registration.create).toHaveBeenCalledWith({
      data: { classId: 10, userId: 'user-1', status: 'Registered' },
    });
  });

  it('rejects a registration when the class is full', async () => {
    prisma.registration.count.mockResolvedValue(10);

    await expect(
      service.createRegistration(10, 'user-2', 10),
    ).rejects.toMatchObject({
      message: 'Class is full',
    });
    expect(prisma.registration.create).not.toHaveBeenCalled();
  });

  it('does not count canceled registrations toward capacity', async () => {
    prisma.registration.count.mockResolvedValue(0);
    prisma.registration.create.mockResolvedValue(existing);

    await service.createRegistration(10, 'user-2', 1);

    expect(prisma.registration.count).toHaveBeenCalledWith({
      where: { classId: 10, status: 'Registered' },
    });
  });

  it('reactivates a canceled registration', async () => {
    const canceled = { ...existing, status: 'Canceled' };
    prisma.registration.findFirst.mockResolvedValue(canceled);
    prisma.registration.count.mockResolvedValue(0);
    prisma.registration.update.mockResolvedValue(existing);

    await expect(service.createRegistration(10, 'user-1', 1)).resolves.toEqual(
      existing,
    );
    expect(prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'Registered',
        registeredAt: expect.any(Date) as never,
      },
    });
    expect(prisma.registration.create).not.toHaveBeenCalled();
  });

  it('maps a database uniqueness race to a conflict', async () => {
    prisma.registration.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createRegistration(10, 'user-2', 10),
    ).rejects.toMatchObject({
      message: 'Already registered for this class',
    });
  });

  it('rejects duplicate registration with 409', async () => {
    prisma.registration.findFirst.mockResolvedValue(existing);

    await expect(service.createRegistration(10, 'user-1', 10)).rejects.toThrow(
      RpcException,
    );
    await expect(
      service.createRegistration(10, 'user-1', 10),
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

  it('updates and deletes registrations', async () => {
    prisma.registration.update.mockResolvedValue({
      ...existing,
      status: 'Canceled',
    });
    prisma.registration.delete.mockResolvedValue(existing);
    prisma.registration.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      service.updateRegistration(1, { status: 'Canceled' }),
    ).resolves.toMatchObject({ status: 'Canceled' });
    await expect(service.deleteRegistration(1)).resolves.toEqual(existing);
    await expect(service.deleteClassRegistrations(10)).resolves.toEqual({
      count: 1,
    });
  });

  it('creates and lists contact submissions', async () => {
    const contact = {
      id: 1,
      name: 'Person',
      email: 'person@example.com',
      subject: 'Question',
      message: 'Hello',
    };
    const contactModel = {
      create: jest.fn().mockResolvedValue(contact),
      findMany: jest.fn().mockResolvedValue([contact]),
    };
    (
      prisma as typeof prisma & { contactSubmission: typeof contactModel }
    ).contactSubmission = contactModel;

    await expect(service.createContactSubmission(contact)).resolves.toEqual(
      contact,
    );
    await expect(service.getContactSubmissions()).resolves.toEqual([contact]);
    expect(contactModel.findMany).toHaveBeenCalledWith({
      take: 50,
      skip: 0,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });
});
