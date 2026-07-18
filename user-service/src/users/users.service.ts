import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { User } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private users: Map<string, User> = new Map();

  create(dto: CreateUserDto): User {
    const now = new Date();
    const user: User = {
      id: uuid(),
      googleId: dto.googleId,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl,
      isTeacher: dto.isTeacher ?? false,
      phoneNumber: dto.phoneNumber,
      preferredName: dto.preferredName,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  findAll(): User[] {
    return Array.from(this.users.values());
  }

  findById(id: string): User {
    const user = this.users.get(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  findByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  findByGoogleId(googleId: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.googleId === googleId);
  }

  update(id: string, dto: UpdateUserDto): User {
    const user = this.findById(id);
    const updated: User = {
      ...user,
      ...dto,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  remove(id: string): void {
    this.findById(id);
    this.users.delete(id);
  }
}
