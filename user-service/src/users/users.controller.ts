import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { UserRole } from '../generated/prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('batch')
  async findByIds(@Query('ids') ids: string) {
    const idList = ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const users = await this.usersService.findByIds(idList);
    return users.map(({ id, firstName, lastName, avatarUrl, role }) => ({
      id,
      firstName,
      lastName,
      avatarUrl,
      role,
    }));
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role', new ParseEnumPipe(UserRole)) role: UserRole,
  ) {
    return this.usersService.updateRole(id, role);
  }

  @UseGuards(AdminGuard)
  @Patch(':id/ban')
  toggleBan(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleBan(id);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
