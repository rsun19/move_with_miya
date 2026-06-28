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
      isTeacher: false,
      preferences: {
        receiveNewsletter: false,
        receiveClassNotifications: {
          email: false,
          sms: false,
        },
      },
      joinDate: new Date(),
    };
  }

  findUsers(): User[] {
    return [
      {
        id: 1,
        email: 'hello',
        firstName: 'hello',
        isTeacher: false,
        preferences: {
          receiveNewsletter: false,
          receiveClassNotifications: {
            email: false,
            sms: false,
          },
        },
        joinDate: new Date(),
      },
    ];
  }

  createUser(): User {
    return {
      id: 1,
      email: 'hello',
      firstName: 'hello',
      isTeacher: false,
      preferences: {
        receiveNewsletter: false,
        receiveClassNotifications: {
          email: false,
          sms: false,
        },
      },
      joinDate: new Date(),
    };
  }
}
