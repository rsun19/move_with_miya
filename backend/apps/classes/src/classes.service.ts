import {
  ClassStatus,
  YogaClass,
} from '@app/shared/interfaces/classes.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ClassesService {
  getHello(): string {
    return 'Hello World!';
  }

  findClasses(): YogaClass[] {
    return [
      {
        id: 1,
        name: 'Morning Yoga',
        teacherIds: [1],
        capacity: 20,
        startDate: new Date('2024-06-01T08:00:00Z'),
        endDate: new Date('2024-06-01T09:00:00Z'),
        location: {
          address: '123 Yoga St',
          city: 'Yoga City',
          state: 'CA',
          zipCode: '90001',
        },
        status: ClassStatus.Scheduled,
      },
    ];
  }

  findClassesInRange(startDate: string, endDate: string): YogaClass[] {
    return this.findClasses().filter(
      (c) =>
        c.startDate >= new Date(startDate) && c.endDate <= new Date(endDate),
    );
  }

  findClassesByTeacher(teacherId: number): YogaClass[] {
    return this.findClasses().filter((c) => c.teacherIds.includes(teacherId));
  }

  findClass(id: number): YogaClass {
    return {
      id: id,
      name: 'Morning Yoga',
      teacherIds: [],
      capacity: 20,
      startDate: new Date('2024-06-01T08:00:00Z'),
      endDate: new Date('2024-06-01T09:00:00Z'),
      location: {
        address: '123 Yoga St',
        city: 'Yoga City',
        state: 'CA',
        zipCode: '90001',
      },
      status: ClassStatus.Scheduled,
    };
  }

  createClass(): YogaClass {
    return {
      id: 2,
      name: 'Evening Yoga',
      teacherIds: [],
      capacity: 20,
      startDate: new Date('2024-06-01T18:00:00Z'),
      endDate: new Date('2024-06-01T19:00:00Z'),
      location: {
        address: '123 Yoga St',
        city: 'Yoga City',
        state: 'CA',
        zipCode: '90001',
      },
      status: ClassStatus.Scheduled,
    };
  }

  updateClass(id: number): YogaClass {
    return {
      id: id,
      name: 'Updated Yoga Class',
      teacherIds: [],
      capacity: 20,
      startDate: new Date('2024-06-01T08:00:00Z'),
      endDate: new Date('2024-06-01T09:00:00Z'),
      location: {
        address: '123 Yoga St',
        city: 'Yoga City',
        state: 'CA',
        zipCode: '90001',
      },
      status: ClassStatus.Scheduled,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteClass(id: number): void {
    // In a real implementation, this would delete the class from the database
  }
}
