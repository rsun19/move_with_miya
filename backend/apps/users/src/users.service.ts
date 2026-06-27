import { Injectable } from '@nestjs/common';
import { User } from '@app/shared/interfaces/user.interface';

@Injectable()
export class UsersService {
  getHello(): string {
    return 'Hello World!';
  }

  findUser(): User {
    return {
      id: 1,
      email: 'hello',
      firstName: 'hello',
      isAdmin: false,
    };
  }

  findUsers(): User[] {
    return [
      {
        id: 1,
        email: 'hello',
        firstName: 'hello',
        isAdmin: false,
      },
    ];
  }

  createUser(): User {
    return {
      id: 1,
      email: 'hello',
      firstName: 'hello',
      isAdmin: false,
    };
  }
}
