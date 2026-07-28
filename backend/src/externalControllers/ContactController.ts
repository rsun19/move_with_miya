import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('contact')
export class ContactController {
  constructor(
    @Inject('REGISTRATION_SERVICE')
    private readonly registrationClient: ClientProxy,
  ) {}

  @Post()
  create(
    @Body()
    body: {
      name: string;
      email: string;
      subject: string;
      message: string;
    },
  ) {
    return this.registrationClient.send(
      { cmd: 'create_contact_submission' },
      body,
    );
  }

  @UseGuards(AdminGuard)
  @Get()
  findAll() {
    return this.registrationClient.send({ cmd: 'get_contact_submissions' }, {});
  }
}
