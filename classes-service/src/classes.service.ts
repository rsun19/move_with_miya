import { Injectable } from '@nestjs/common';
import { ClassStatus, YogaClass } from './classes.interface';

const defaultLocation = {
  address: '123 Yoga St',
  city: 'Yoga City',
  state: 'CA',
  zipCode: '90001',
};

function yogaClass(overrides: Partial<YogaClass> = {}): YogaClass {
  return {
    id: 1,
    name: 'Morning Yoga',
    teacherIds: [],
    capacity: 20,
    startDate: new Date('2024-06-01T08:00:00Z'),
    endDate: new Date('2024-06-01T09:00:00Z'),
    location: defaultLocation,
    status: ClassStatus.Scheduled,
    private: false,
    ...overrides,
  };
}

@Injectable()
export class ClassesService {
  findClasses(): YogaClass[] {
    return [yogaClass({ id: 1, teacherIds: [1] })];
  }

  findClassesInRange(startDate: string, endDate: string): YogaClass[] {
    return this.findClasses().filter(
      (c) =>
        c.startDate >= new Date(startDate) && c.endDate <= new Date(endDate),
    );
  }

  findClass(id: number): YogaClass {
    return yogaClass({ id });
  }

  createClass(): YogaClass {
    return yogaClass({
      id: 2,
      name: 'Evening Yoga',
      startDate: new Date('2024-06-01T18:00:00Z'),
      endDate: new Date('2024-06-01T19:00:00Z'),
    });
  }

  updateClass(id: number): YogaClass {
    return yogaClass({ id, name: 'Updated Yoga Class' });
  }

  deleteClass(id: number): void {
  }
}
