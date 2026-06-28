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

@Controller('users')
export class UserController {
  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  @Get()
  findUsers() {
    return this.usersClient.send({ cmd: 'get_users' }, {});
  }

  @Get(':id')
  findUser(@Param('id') id: string) {
    return this.usersClient.send({ cmd: 'get_user' }, { id });
  }

  @Post()
  createUser() {
    return this.usersClient.send({ cmd: 'create_user' }, {});
  }

  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.usersClient.send({ cmd: 'update_user' }, { id, ...body });
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersClient.send({ cmd: 'delete_user' }, { id });
  }
}
