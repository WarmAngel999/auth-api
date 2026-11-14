import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './notification.entity';

export interface TransferCompletedData {
  eventId: string;
  transferId: number;
  fromUserId: number;
  toUserId: number;
  amount: number; // в копейках
}

// суммы хранятся в копейках, в рубли переводим только при формировании текста
export function formatRubles(kopecks: number): string {
  const rubles = Math.floor(kopecks / 100);
  const rest = String(kopecks % 100).padStart(2, '0');
  return `${rubles},${rest}`;
}

const toDto = (n: Notification) => ({
  id: n.id,
  type: n.type,
  text: n.text,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // идемпотентно: повторная обработка того же события ничего не добавляет
  async createFromTransfer(data: TransferCompletedData): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values({
        userId: data.toUserId,
        eventId: data.eventId,
        type: 'transfer.received',
        text: `Пользователь #${data.fromUserId} перевёл вам ${formatRubles(data.amount)} руб.`,
      })
      .orIgnore()
      .execute();
  }

  async list(userId: number, limit: number, cursor?: number) {
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.id', 'DESC')
      .limit(limit + 1);
    if (cursor) qb.andWhere('n.id < :cursor', { cursor });

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(toDto),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async unreadCount(userId: number) {
    const count = await this.repo.countBy({ userId, readAt: IsNull() });
    return { count };
  }

  async markRead(userId: number, id: number) {
    // чужое и несуществующее уведомление неразличимы: оба дают 404
    const found = await this.repo.findOneBy({ id, userId });
    if (!found) throw new NotFoundException('notification not found');
    if (!found.readAt) {
      found.readAt = new Date();
      await this.repo.update(
        { id, userId, readAt: IsNull() },
        { readAt: found.readAt },
      );
    }
    return toDto(found);
  }

  async markAllRead(userId: number) {
    const result = await this.repo.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }
}
