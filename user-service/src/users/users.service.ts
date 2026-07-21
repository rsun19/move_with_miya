import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    return this.prisma.client.user.create({ data: dto });
  }

  async findAll() {
    return this.prisma.client.user.findMany();
  }

  async findById(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.client.user.findUnique({ where: { email } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.client.user.findUnique({ where: { googleId } });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    return this.prisma.client.user.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.client.user.delete({ where: { id } });
  }
}
