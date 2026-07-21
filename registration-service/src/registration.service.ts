import { Injectable } from '@nestjs/common';
import { Registration, RegistrationStatus } from './registration.interface';

@Injectable()
export class RegistrationService {
  findRegistrations(classId: number): Registration[] {
    return [];
  }

  findRegistration(id: number): Registration {
    return {
      userId: 1,
      classId: 1,
      id: id,
      status: RegistrationStatus.Registered,
      registeredAt: new Date(),
    };
  }

  createRegistration(classId: number, userId: number): Registration {
    return {
      id: 1,
      classId,
      userId,
      status: RegistrationStatus.Registered,
      registeredAt: new Date(),
    };
  }

  updateRegistration(id: number): Registration {
    return {
      id,
      classId: 1,
      userId: 1,
      status: RegistrationStatus.Registered,
      registeredAt: new Date(),
    };
  }

  deleteRegistration(id: number, classId: number): void {
  }

  deleteClassRegistrations(classId: number): void {
  }
}
