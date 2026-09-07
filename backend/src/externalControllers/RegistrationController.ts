import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Delete,
  Get,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { AdminGuard } from '../common/guards/admin.guard';
import { StaffGuard } from '../common/guards/staff.guard';

interface Registration {
  id: number;
  userId: string;
  classId: number;
  status: string;
  registeredAt: string;
}

@Controller('registration')
export class RegistrationController {
  constructor(
    @Inject('REGISTRATION_SERVICE')
    private readonly registrationClient: ClientProxy,
    @Inject('CLASSES_SERVICE')
    private readonly classesClient: ClientProxy,
  ) {}

  private async rpc<T = unknown>(cmd: string, payload: object) {
    try {
      return await lastValueFrom<T>(
        this.registrationClient.send<T>({ cmd }, payload),
      );
    } catch (error) {
      const data = (error ?? {}) as {
        statusCode?: number;
        message?: string;
      };
      const status = data.statusCode;
      const message = data.message ?? 'Registration service error';
      if (status === 409) throw new ConflictException(message);
      if (status === 404) throw new NotFoundException(message);
      if (status === 400) throw new BadRequestException(message);
      throw new InternalServerErrorException(message);
    }
  }

  @UseGuards(StaffGuard)
  @Get('class/:classId')
  async findRegistrations(@Param('classId', ParseIntPipe) classId: number) {
    const registrations = await this.rpc<Registration[]>('get_registrations', {
      classId,
    });
    const userIds = [
      ...new Set(registrations.map((r) => r.userId).filter(Boolean)),
    ];
    if (userIds.length === 0) return registrations;

    const userServiceUrl =
      process.env.USER_SERVICE_URL || 'http://localhost:3003';
    const res = await fetch(
      `${userServiceUrl}/users/batch?ids=${encodeURIComponent(
        userIds.join(','),
      )}`,
      { cache: 'no-store' },
    );
    const users = res.ok
      ? ((await res.json()) as Record<string, unknown>[])
      : [];
    const userMap = new Map(users.map((u) => [String(u.id), u]));

    return registrations.map((r) => ({
      ...r,
      user: userMap.get(r.userId) ?? null,
    }));
  }

  @Get('me')
  async getMyRegistrations(@Req() req: Request) {
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.rpc<Registration[]>('get_registrations_by_user', { userId });
  }

  @UseGuards(AdminGuard)
  @Get(':id')
  findRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.rpc<Registration>('get_registration', { id });
  }

  @Post('class/:classId/user/:userId')
  async createRegistration(
    @Req() req: Request,
    @Param('classId', ParseIntPipe) classId: number,
    @Param('userId') userId: string,
  ) {
    if (!req.session?.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    if (req.session.userId !== userId) {
      throw new ForbiddenException(
        'You can only register yourself for a class',
      );
    }
    const cls = await this.assertClassOpenForRegistration(classId, userId);
    return this.rpc<Registration>('create_registration', {
      classId,
      userId,
      capacity: cls.capacity,
    });
  }

  private async assertClassOpenForRegistration(
    classId: number,
    userId: string,
  ): Promise<{
    capacity: number;
  }> {
    let cls: {
      capacity?: number;
      endDate?: string;
      status?: string;
      isPrivate?: boolean;
    } | null = null;
    try {
      cls = await lastValueFrom(
        this.classesClient.send({ cmd: 'get_class' }, { id: classId }),
      );
    } catch {
      throw new ServiceUnavailableException('Class service unavailable');
    }
    if (!cls) {
      throw new NotFoundException(`Class ${classId} not found`);
    }
    if (cls.status === 'Canceled' || cls.status === 'Completed') {
      throw new ForbiddenException('This class is not open for registration');
    }
    if (cls.endDate && new Date(cls.endDate).getTime() <= Date.now()) {
      throw new ForbiddenException('This class has already ended');
    }
    const capacity = cls.capacity;
    if (
      capacity === undefined ||
      !Number.isInteger(capacity) ||
      capacity <= 0
    ) {
      throw new ServiceUnavailableException('Class capacity is invalid');
    }

    const userServiceUrl =
      process.env.USER_SERVICE_URL || 'http://localhost:3003';
    let userResponse: Response;
    try {
      userResponse = await fetch(`${userServiceUrl}/users/${userId}`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('User service unreachable');
    }
    if (userResponse.status >= 500) {
      throw new ServiceUnavailableException('User service error');
    }
    if (!userResponse.ok) {
      throw new UnauthorizedException('Unable to verify user');
    }
    const user = (await userResponse.json()) as {
      banned?: boolean;
      yogaExperience?: string | null;
    };
    if (user.banned) {
      throw new ForbiddenException('User is banned');
    }
    if (cls.isPrivate && !user.yogaExperience?.trim()) {
      throw new ForbiddenException(
        'Yoga experience is required for this class',
      );
    }

    return { capacity };
  }

  @Get('class/:classId/me')
  async getMyRegistration(
    @Req() req: Request,
    @Param('classId', ParseIntPipe) classId: number,
  ) {
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.rpc<Registration>('get_registration_by_class_and_user', {
      classId,
      userId,
    });
  }

  @Delete('class/:classId/me')
  async cancelMyRegistration(
    @Req() req: Request,
    @Param('classId', ParseIntPipe) classId: number,
  ) {
    const userId = req.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.rpc<Registration>('delete_registration_by_class_and_user', {
      classId,
      userId,
    });
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  updateRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.rpc<Registration>('update_registration', { id, ...body });
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  deleteRegistration(@Param('id', ParseIntPipe) id: number) {
    return this.rpc<Registration>('delete_registration', { id });
  }

  @UseGuards(AdminGuard)
  @Delete('class/:classId')
  deleteClassRegistrations(@Param('classId', ParseIntPipe) classId: number) {
    return this.rpc<Registration>('delete_registrations', { classId });
  }
}
