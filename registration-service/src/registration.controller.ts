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
  createRegistration(data: { classId: number; userId: number } & Record<string, unknown>) {
    return this.registrationService.createRegistration(data.classId, data.userId);
  }

  @MessagePattern({ cmd: 'update_registration' })
  updateRegistration(data: { id: number } & Record<string, unknown>) {
    return this.registrationService.updateRegistration(data.id);
  }

  @MessagePattern({ cmd: 'delete_registration' })
  deleteRegistration(data: { classId: number; id: number }) {
    return this.registrationService.deleteRegistration(data.id, data.classId);
  }

  @MessagePattern({ cmd: 'delete_registrations' })
  deleteClassRegistrations(data: { classId: number }) {
    return this.registrationService.deleteClassRegistrations(data.classId);
  }
}
