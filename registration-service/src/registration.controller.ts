import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { RegistrationService } from './registration.service';

@Controller()
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @MessagePattern({ cmd: 'get_registrations' })
  findRegistrations(data: { classId: number }) {
    return this.registrationService.findRegistrations(data.classId);
  }

  @MessagePattern({ cmd: 'get_registration' })
  findRegistration(data: { id: number }) {
    return this.registrationService.findRegistration(data.id);
  }

  @MessagePattern({ cmd: 'create_registration' })
  createRegistration(
    data: { classId: number; userId: string } & Record<string, unknown>,
  ) {
    return this.registrationService.createRegistration(
      data.classId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'get_registrations_by_user' })
  findRegistrationsByUser(data: { userId: string }) {
    return this.registrationService.findRegistrationsByUser(data.userId);
  }

  @MessagePattern({ cmd: 'get_registration_counts' })
  getRegistrationCounts(data: { classIds: number[] }) {
    return this.registrationService.getRegistrationCounts(data.classIds);
  }

  @MessagePattern({ cmd: 'get_registration_by_class_and_user' })
  findRegistrationByClassAndUser(data: { classId: number; userId: string }) {
    return this.registrationService.findRegistrationByClassAndUser(
      data.classId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'delete_registration_by_class_and_user' })
  deleteRegistrationByClassAndUser(data: { classId: number; userId: string }) {
    return this.registrationService.deleteRegistrationByClassAndUser(
      data.classId,
      data.userId,
    );
  }

  @MessagePattern({ cmd: 'update_registration' })
  updateRegistration(data: { id: number } & Record<string, unknown>) {
    const { id, ...rest } = data;
    return this.registrationService.updateRegistration(id, rest);
  }

  @MessagePattern({ cmd: 'delete_registration' })
  deleteRegistration(data: { id: number }) {
    return this.registrationService.deleteRegistration(data.id);
  }

  @MessagePattern({ cmd: 'delete_registrations' })
  deleteClassRegistrations(data: { classId: number }) {
    return this.registrationService.deleteClassRegistrations(data.classId);
  }

  @MessagePattern({ cmd: 'create_contact_submission' })
  createContactSubmission(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    return this.registrationService.createContactSubmission(data);
  }

  @MessagePattern({ cmd: 'get_contact_submissions' })
  getContactSubmissions(data: { take?: number; skip?: number }) {
    return this.registrationService.getContactSubmissions(data.take, data.skip);
  }
}
