import { Injectable } from '@nestjs/common';
import { User } from '@app/shared/interfaces/user.interface';

@Injectable()
export class UsersService {
  getHello(): string {
    return 'Hello World!';
  }

  async findUser(): Promise<User> {
    return {
      id: 1,
      email: 'hello',
      firstName: 'hello',
      isAdmin: false,
    };
  }

  async findUsers(): Promise<User[]> {
    return [
      {
        id: 1,
        email: 'hello',
        firstName: 'hello',
        isAdmin: false,
      },
    ];
  }

  async createUser(): Promise<User> {
    return {
      id: 1,
      email: 'hello',
      firstName: 'hello',
      isAdmin: false,
    };
  }
}
