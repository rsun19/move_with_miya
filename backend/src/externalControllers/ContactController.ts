import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { UpdateContactReadDto } from './dto/update-contact-read.dto';
import { ContactEmailService } from './contact-email.service';

interface ContactSubmissionRecord {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

@Controller('contact')
export class ContactController {
  constructor(
    @Inject('REGISTRATION_SERVICE')
    private readonly registrationClient: ClientProxy,
    private readonly contactEmailService: ContactEmailService,
  ) {}

  @Post()
  async create(@Body() dto: CreateContactSubmissionDto) {
    const submission = await lastValueFrom<ContactSubmissionRecord>(
      this.registrationClient.send<ContactSubmissionRecord>(
        { cmd: 'create_contact_submission' },
        dto,
      ),
    );
    await this.contactEmailService.notify(dto);
    return submission;
  }

  @UseGuards(AdminGuard)
  @Get()
  findAll(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.registrationClient.send<ContactSubmissionRecord[]>(
      { cmd: 'get_contact_submissions' },
      {
        take: take ? parseInt(take, 10) : undefined,
        skip: skip ? parseInt(skip, 10) : undefined,
      },
    );
  }

  @UseGuards(AdminGuard)
  @Patch(':id/read')
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactReadDto,
  ) {
    return this.registrationClient.send<ContactSubmissionRecord>(
      { cmd: 'mark_contact_submission_read' },
      { id, read: dto.read },
    );
  }
}
