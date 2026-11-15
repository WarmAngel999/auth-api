import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent } from '../outbox/outbox-event.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(OutboxEvent)
    private readonly events: Repository<OutboxEvent>,
  ) {}

  // сколько событий ждёт публикации и как давно ждёт самое старое
  async outboxStats() {
    const row = await this.events
      .createQueryBuilder('e')
      .select('COUNT(*)', 'count')
      .addSelect('MIN(e.createdAt)', 'oldest')
      .where('e.publishedAt IS NULL')
      .getRawOne<{ count: string; oldest: Date | null }>();

    const oldest = row?.oldest ? new Date(row.oldest) : null;
    return {
      unpublished: Number(row?.count ?? 0),
      oldestAgeSeconds: oldest
        ? Math.round((Date.now() - oldest.getTime()) / 1000)
        : null,
    };
  }
}
