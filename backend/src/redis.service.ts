import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

@Injectable()
export class RedisService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly client: RedisClient;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient({
      url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
    });
  }

  getClient(): RedisClient {
    return this.client;
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
