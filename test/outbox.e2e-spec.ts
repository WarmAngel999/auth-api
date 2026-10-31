import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import request from 'supertest';
import { DataSource, EntityManager } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxRelay } from '../src/outbox/outbox.relay';

jest.setTimeout(30000);
process.env.OUTBOX_RELAY_AUTOSTART = 'false';

const PASSWORD = 'secret123';

describe('Outbox (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let relay: OutboxRelay;
  let addSpy: jest.SpyInstance;

  const http = () => request(app.getHttpServer());
  const register = (email: string) =>
    http().post('/auth/register').send({ email, password: PASSWORD });
  const events = () =>
    dataSource.query(
      'SELECT id, type, payload, processed_at FROM outbox_events ORDER BY id',
    );

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
    await dataSource.synchronize(true);
    relay = app.get(OutboxRelay);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE outbox_events, transfers, wallets, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    // подменяем добавление в очередь: Redis в этих тестах не участвует
    addSpy = jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registration writes a user.registered event', async () => {
    const res = await register('a@example.com').expect(201);

    const rows = await events();
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('user.registered');
    expect(rows[0].payload).toEqual({ userId: res.body.id, email: 'a@example.com' });
    expect(rows[0].processed_at).toBeNull();
  });

  it('a duplicate email returns 409 and adds no second event', async () => {
    await register('a@example.com').expect(201);
    await register('a@example.com').expect(409);

    expect(await events()).toHaveLength(1);
  });

  it('rolls back the user if the event cannot be written', async () => {
    jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockRejectedValueOnce(new Error('boom'));

    await register('a@example.com').expect(500);

    const [{ count }] = await dataSource.query(
      "SELECT count(*)::int AS count FROM users WHERE email = 'a@example.com'",
    );
    expect(count).toBe(0);
    expect(await events()).toHaveLength(0);
  });

  it('relay puts the event into the queue and marks it processed', async () => {
    const res = await register('a@example.com').expect(201);

    await relay.tick();

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith(
      'confirm-email',
      { userId: res.body.id, email: 'a@example.com' },
      expect.objectContaining({ jobId: `confirm-${res.body.id}` }),
    );
    const [row] = await events();
    expect(row.processed_at).not.toBeNull();
  });

  it('does not send a processed event again', async () => {
    await register('a@example.com').expect(201);

    await relay.tick();
    await relay.tick();

    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the event when the queue is down and delivers it later', async () => {
    addSpy.mockRejectedValueOnce(new Error('redis down'));
    await register('a@example.com').expect(201);

    await relay.tick(); // очередь недоступна
    expect((await events())[0].processed_at).toBeNull();

    await relay.tick(); // очередь снова работает
    expect((await events())[0].processed_at).not.toBeNull();
    expect(addSpy).toHaveBeenCalledTimes(2);
  });
});
