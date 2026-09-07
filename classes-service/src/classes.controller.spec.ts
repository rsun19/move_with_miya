jest.mock('./prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('./generated/prisma/client', () => ({
  ClassStatus: { Scheduled: 'Scheduled' },
}));

import { ClassesController } from './classes.controller';

describe('ClassesController', () => {
  const service = {
    findClasses: jest.fn(),
    findClassesInRange: jest.fn(),
    findClass: jest.fn(),
    createClass: jest.fn(),
    updateClass: jest.fn(),
    deleteClass: jest.fn(),
  };
  let controller: ClassesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClassesController(service as never);
  });

  it('forwards reads', async () => {
    await controller.findClasses();
    await controller.findClassesInRange({ from: 'from', to: 'to' });
    await controller.findClass({ id: 2 });
    expect(service.findClasses).toHaveBeenCalledWith();
    expect(service.findClassesInRange).toHaveBeenCalledWith('from', 'to');
    expect(service.findClass).toHaveBeenCalledWith(2);
  });

  it('forwards creates, updates, and deletes', async () => {
    const data = {
      id: 2,
      name: 'Flow',
      teacherIds: ['teacher-1'],
      capacity: 10,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      locationId: 1,
    };
    await controller.createClass(data);
    await controller.updateClass(data);
    await controller.deleteClass({ id: 2 });
    expect(service.createClass).toHaveBeenCalledWith(data);
    expect(service.updateClass).toHaveBeenCalledWith(2, {
      name: 'Flow',
      teacherIds: ['teacher-1'],
      capacity: 10,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      locationId: 1,
    });
    expect(service.deleteClass).toHaveBeenCalledWith(2);
  });
});
