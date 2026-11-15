import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxRelay } from '../src/outbox/outbox.relay';

jest.setTimeout(30000);
process.env.OUTBOX_RELAY_AUTOSTART = 'false';

const PASSWORD = 'secret123';

describe('Outbox publisher (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let relay: OutboxRelay;
  let addSpy: jest.SpyInstance;
  let aliceToken: string;
  let bobId: number;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const transfer = (amount: number, key: string) =>
    http()
      .post('/wallet/transfer')
      .set(bearer(aliceToken))
      .set('Idempotency-Key', key)
      .send({ toUserId: bobId, amount });

  const publishedAt = async () => {
    const [row] = await dataSource.query(
      'SELECT published_at FROM outbox_events',
    );
    return row.published_at as Date | null;
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
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE notifications, outbox_events, transfers, wallets, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    const alice = await http()
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: PASSWORD })
      .expect(201);
    bobId = (
      await http()
        .post('/auth/register')
        .send({ email: 'bob@example.com', password: PASSWORD })
        .expect(201)
    ).body.id;
    await dataSource.query("UPDATE users SET role = 'admin' WHERE id = $1", [
      alice.body.id,
    ]);
    const login = await http()
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD });
    aliceToken = login.body.accessToken;

    await http()
      .post('/wallet/deposit')
      .set(bearer(aliceToken))
      .send({ amount: 10000 })
      .expect(201);
    await dataSource.query('TRUNCATE TABLE outbox_events');

    // Redis в этих тестах не участвует: подменяем добавление в очередь
    addSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Redis is down: the transfer returns 201, the event is published later', async () => {
    addSpy.mockRejectedValue(new Error('redis down'));

    await transfer(3000, 'k1').expect(201);
    await relay.tick();

    // транзакция публикатора откатилась: событие осталось неопубликованным
    expect(await publishedAt()).toBeNull();

    addSpy.mockResolvedValue({} as never);
    await relay.tick();

    expect(await publishedAt()).not.toBeNull();
  });

  it('two publishers at once publish every event exactly once', async () => {
    await dataSource.query(`
      INSERT INTO outbox_events (type, payload)
      SELECT 'transfer.completed',
             jsonb_build_object('transferId', g, 'fromUserId', 1, 'toUserId', 2, 'amount', 100)
      FROM generate_series(1, 150) g
    `);

    // задержка на каждую задачу: транзакции двух публикаторов действительно перекрываются
    addSpy.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {} as never;
    });

    const second = new OutboxRelay(
      dataSource,
      app.get<Queue>(getQueueToken('mail')),
      app.get<Queue>(getQueueToken('notifications')),
    );

    await Promise.all([relay.tick(), second.tick()]);
    await relay.tick(); // остаток, если пачки не хватило на все события

    const jobIds = addSpy.mock.calls
      .filter(([name]) => name === 'transfer-completed')
      .map(([, , options]) => (options as { jobId: string }).jobId);
    expect(jobIds).toHaveLength(150);
    expect(new Set(jobIds).size).toBe(150);

    const [{ n }] = await dataSource.query(
      'SELECT count(*)::int AS n FROM outbox_events WHERE published_at IS NULL',
    );
    expect(n).toBe(0);
  });
});
