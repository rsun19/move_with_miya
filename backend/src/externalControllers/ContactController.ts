import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';

@Controller('contact')
export class ContactController {
  constructor(
    @Inject('REGISTRATION_SERVICE')
    private readonly registrationClient: ClientProxy,
  ) {}

  @Post()
  create(@Body() dto: CreateContactSubmissionDto) {
    return this.registrationClient.send(
      { cmd: 'create_contact_submission' },
      dto,
    );
  }

  @UseGuards(AdminGuard)
  @Get()
  findAll() {
    return this.registrationClient.send({ cmd: 'get_contact_submissions' }, {});
  }
}
