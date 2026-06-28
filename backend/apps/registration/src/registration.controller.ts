import { Controller, Get } from '@nestjs/common';
import { RegistrationService } from './registration.service';

@Controller()
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Get()
  getHello(): string {
    return this.registrationService.getHello();
  }
}
