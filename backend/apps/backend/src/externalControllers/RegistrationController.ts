import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('registration')
export class RegistrationController {
  constructor(
    @Inject('REGISTRATION_SERVICE')
    private readonly registrationClient: ClientProxy,
  ) {}

  @Get(':classId')
  findRegistrations(@Param('classId') classId: string) {
    return this.registrationClient.send(
      { cmd: 'get_registrations' },
      { classId },
    );
  }

  @Get(':id')
  findRegistration(@Param('id') id: string) {
    return this.registrationClient.send({ cmd: 'get_registration' }, { id });
  }

  @Post(':classId/:id')
  createRegistration(
    @Param('classId') classId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.registrationClient.send(
      { cmd: 'create_registration' },
      { classId, id, ...body },
    );
  }

  @Patch(':id')
  updateRegistration(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.registrationClient.send(
      { cmd: 'update_registration' },
      { id, ...body },
    );
  }

  @Delete(':classId/:id')
  deleteRegistration(
    @Param('classId') classId: string,
    @Param('id') id: string,
  ) {
    return this.registrationClient.send(
      { cmd: 'delete_registration' },
      { classId, id },
    );
  }

  @Delete(':classId')
  deleteClassRegistrations(@Param('classId') classId: string) {
    return this.registrationClient.send(
      { cmd: 'delete_registrations' },
      { classId },
    );
  }
}
