import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('users')
export class AppController {
  constructor(
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}

  @Get()
  findUsers() {
    return this.usersClient.send({ cmd: 'get_users' }, {});
  }

  @Get(':id')
  findUser() {
    return this.usersClient.send({ cmd: 'get_user' }, {});
  }
}
