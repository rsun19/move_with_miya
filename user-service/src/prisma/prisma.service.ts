import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public client: PrismaClient;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl =
      this.configService.get<string>('USER_SERVICE_DATABASE_URL') ??
      this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
