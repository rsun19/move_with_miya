import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
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

  @Get('class/:classId')
  findRegistrations(@Param('classId', ParseIntPipe) classId: number) {
    return this.registrationClient.send(
      { cmd: 'get_registrations' },
      { classId },
    );
  }

  @Get(':id')
  findRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.registrationClient.send({ cmd: 'get_registration' }, { id });
  }

  @Post('class/:classId/user/:userId')
  createRegistration(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('userId') userId: string,
  ) {
    return this.registrationClient.send(
      { cmd: 'create_registration' },
      { classId, userId },
    );
  }

  @Patch(':id')
  updateRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.registrationClient.send(
      { cmd: 'update_registration' },
      { id, ...body },
    );
  }

  @Delete('class/:classId/registration/:id')
  deleteRegistration(
    @Param('classId', ParseIntPipe) classId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.registrationClient.send(
      { cmd: 'delete_registration' },
      { classId, id },
    );
  }

  @Delete('class/:classId')
  deleteClassRegistrations(@Param('classId', ParseIntPipe) classId: number) {
    return this.registrationClient.send(
      { cmd: 'delete_registrations' },
      { classId },
    );
  }
}
