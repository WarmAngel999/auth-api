import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Job, Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { NotificationsService } from '../src/notifications/notifications.service';
import { OutboxRelay } from '../src/outbox/outbox.relay';

jest.setTimeout(30000);
process.env.OUTBOX_RELAY_AUTOSTART = 'false';

const PASSWORD = 'secret123';

type TestUser = { id: number; token: string };

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let relay: OutboxRelay;
  let processor: NotificationsProcessor;
  let service: NotificationsService;
  let alice: TestUser;
  let bob: TestUser;
  let addSpy: jest.SpyInstance;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createUser = async (
    email: string,
    role: 'user' | 'admin' = 'user',
  ): Promise<TestUser> => {
    const reg = await http()
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);
    const id = reg.body.id as number;
    if (role === 'admin') {
      await dataSource.query("UPDATE users SET role = 'admin' WHERE id = $1", [
        id,
      ]);
    }
    const res = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    return { id, token: res.body.accessToken as string };
  };

  const transfer = (amount: number, key: string) =>
    http()
      .post('/wallet/transfer')
      .set(bearer(alice.token))
      .set('Idempotency-Key', key)
      .send({ toUserId: bob.id, amount });

  const list = (user: TestUser, query = '') =>
    http().get(`/notifications${query}`).set(bearer(user.token));

  const count = async () => {
    const [row] = await dataSource.query(
      'SELECT count(*)::int AS n FROM notifications',
    );
    return row.n as number;
  };

  const waitFor = async (check: () => Promise<boolean>, timeoutMs: number) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('waitFor: timeout');
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0);

    dataSource = app.get(DataSource);
    if (dataSource.options.database !== 'auth_test') {
      throw new Error('E2E-тесты должны работать только с базой auth_test');
    }
    relay = app.get(OutboxRelay);
    processor = app.get(NotificationsProcessor);
    service = app.get(NotificationsService);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE notifications, outbox_events, transfers, wallets, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    alice = await createUser('alice@example.com', 'admin'); // admin: пополняет баланс
    bob = await createUser('bob@example.com');
    await http()
      .post('/wallet/deposit')
      .set(bearer(alice.token))
      .send({ amount: 10000 })
      .expect(201);
    // убираем события регистрации, чтобы остались только события переводов
    await dataSource.query('TRUNCATE TABLE outbox_events');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('delivery without Redis', () => {
    beforeEach(() => {
      // подменяем добавление в очередь: задачу обрабатываем сами, вызывая процессор
      addSpy = jest
        .spyOn(Queue.prototype, 'add')
        .mockResolvedValue({} as never);
    });

    const deliver = async () => {
      for (const [name, data] of addSpy.mock.calls) {
        if (name === 'transfer-completed') {
          await processor.process({ name, data } as unknown as Job);
        }
      }
    };

    it('the publisher marks the event published and the recipient gets a notification', async () => {
      await transfer(3000, 'k1').expect(201);
      await relay.tick();

      const [event] = await dataSource.query(
        'SELECT published_at FROM outbox_events',
      );
      expect(event.published_at).not.toBeNull();

      await deliver();

      const res = await list(bob).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].text).toBe(
        `Пользователь #${alice.id} перевёл вам 30,00 руб.`,
      );
      expect((await list(alice).expect(200)).body.items).toHaveLength(0);
    });

    it('a published event is not published again', async () => {
      await transfer(3000, 'k1').expect(201);
      await relay.tick();
      await relay.tick();

      const calls = addSpy.mock.calls.filter(
        ([name]) => name === 'transfer-completed',
      );
      expect(calls).toHaveLength(1);
    });

    it('the same event delivered twice gives one notification', async () => {
      await transfer(3000, 'k1').expect(201);
      await relay.tick();

      await deliver();
      await deliver();

      expect(await count()).toBe(1);
    });

    it('lists notifications newest first with cursor pagination', async () => {
      for (let i = 0; i < 5; i++) await transfer(100, `p-${i}`).expect(201);
      await relay.tick();
      await deliver();

      const first = await list(bob, '?limit=2').expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).not.toBeNull();

      const collected: number[] = first.body.items.map(
        (x: { id: number }) => x.id,
      );
      let cursor: number | null = first.body.nextCursor;
      let guard = 0;
      while (cursor && ++guard < 10) {
        const page = await list(bob, `?limit=2&cursor=${cursor}`).expect(200);
        collected.push(...page.body.items.map((x: { id: number }) => x.id));
        cursor = page.body.nextCursor;
      }

      expect(collected).toHaveLength(5);
      expect(new Set(collected).size).toBe(5);
      expect(collected).toEqual([...collected].sort((a, b) => b - a));
    });

    it('counts unread, marks one as read and then all', async () => {
      for (let i = 0; i < 3; i++) await transfer(100, `u-${i}`).expect(201);
      await relay.tick();
      await deliver();

      const unread = () =>
        http().get('/notifications/unread-count').set(bearer(bob.token));
      expect((await unread()).body.count).toBe(3);

      const id = (await list(bob)).body.items[0].id as number;
      const read = await http()
        .patch(`/notifications/${id}/read`)
        .set(bearer(bob.token))
        .expect(200);
      expect(read.body.readAt).not.toBeNull();
      expect((await unread()).body.count).toBe(2);

      const all = await http()
        .post('/notifications/read-all')
        .set(bearer(bob.token))
        .expect(200);
      expect(all.body.updated).toBe(2);
      expect((await unread()).body.count).toBe(0);
    });

    it('marking someone else’s or a missing notification returns 404', async () => {
      await transfer(100, 'k1').expect(201);
      await relay.tick();
      await deliver();
      const id = (await list(bob)).body.items[0].id as number;

      await http()
        .patch(`/notifications/${id}/read`)
        .set(bearer(alice.token))
        .expect(404);
      await http()
        .patch('/notifications/999999/read')
        .set(bearer(bob.token))
        .expect(404);

      const [row] = await dataSource.query(
        'SELECT read_at FROM notifications WHERE id = $1',
        [id],
      );
      expect(row.read_at).toBeNull();
    });

    it('rejects an invalid limit or cursor with 400 and a missing token with 401', async () => {
      await list(bob, '?limit=0').expect(400);
      await list(bob, '?limit=abc').expect(400);
      await list(bob, '?cursor=0').expect(400);
      await http().get('/notifications').expect(401);
    });
  });

  describe('retries through BullMQ (needs Redis)', () => {
    it('fails twice, succeeds on the third attempt, still one notification', async () => {
      const queue = app.get<Queue>(getQueueToken('notifications'));
      await queue.obliterate({ force: true });

      const spy = jest
        .spyOn(service, 'createFromTransfer')
        .mockRejectedValueOnce(new Error('boom 1'))
        .mockRejectedValueOnce(new Error('boom 2'));

      await transfer(3000, 'k1').expect(201);
      await relay.tick();

      await waitFor(async () => (await count()) === 1, 20000);

      expect(spy).toHaveBeenCalledTimes(3);
      expect(await count()).toBe(1);
    });
  });
});
