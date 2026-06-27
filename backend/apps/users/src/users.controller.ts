import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { UsersService } from './users.service';
import { type User } from '@app/shared/interfaces/user.interface';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'get_user' })
  findUser(): User {
    return this.usersService.findUser();
  }

  @MessagePattern({ cmd: 'get_users' })
  findUsers(): User[] {
    return this.usersService.findUsers();
  }

  @MessagePattern({ cmd: 'create_user' })
  createUser(): User {
    return this.usersService.createUser();
  }
}
