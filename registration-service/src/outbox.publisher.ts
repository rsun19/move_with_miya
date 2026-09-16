import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REGISTRATION_EVENTS') private readonly events: ClientProxy,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.publish(), 2_000);
    void this.publish();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async publish() {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.prisma.client.outboxEvent.findMany({
        where: { processedAt: null, availableAt: { lte: new Date() } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 25,
      });
      for (const event of events) {
        try {
          await firstValueFrom(
            this.events.emit(
              { event: 'registration.lifecycle' },
              {
                eventId: event.id,
                eventKey: event.eventKey,
                eventType: event.eventType,
                aggregateId: event.aggregateId,
                payload: event.payload,
              },
            ),
          );
          await this.prisma.client.outboxEvent.update({
            where: { id: event.id },
            data: { processedAt: new Date() },
          });
        } catch {
          await this.prisma.client.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts: { increment: 1 },
              availableAt: new Date(
                Date.now() + 2 ** Math.min(event.attempts, 6) * 1_000,
              ),
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
