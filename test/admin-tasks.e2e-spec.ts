import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxRelay } from '../src/outbox/outbox.relay';
import { TasksService } from '../src/tasks/tasks.service';

jest.setTimeout(30000);
process.env.OUTBOX_RELAY_AUTOSTART = 'false';

const PASSWORD = 'secret123';

type TestUser = { id: number; token: string };

describe('Scheduled tasks and admin endpoints (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tasks: TasksService;
  let relay: OutboxRelay;
  let admin: TestUser;
  let bob: TestUser;

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
      .set(bearer(admin.token))
      .set('Idempotency-Key', key)
      .send({ toUserId: bob.id, amount });

  const walletId = async (userId: number) => {
    const [row] = await dataSource.query(
      'SELECT id FROM wallets WHERE user_id = $1',
      [userId],
    );
    return row.id as number;
  };

  const insertSession = async (userId: number, expiresAt: string) => {
    const [row] = await dataSource.query(
      `INSERT INTO refresh_tokens (id, "userId", "tokenHash", "expiresAt")
       VALUES (gen_random_uuid(), $1, 'hash', ${expiresAt}) RETURNING id`,
      [userId],
    );
    return row.id as string;
  };

  const sessionExists = async (id: string) => {
    const [row] = await dataSource.query(
      'SELECT count(*)::int AS n FROM refresh_tokens WHERE id = $1',
      [id],
    );
    return row.n === 1;
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
    tasks = app.get(TasksService);
    relay = app.get(OutboxRelay);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE reconciliation_reports, notifications, outbox_events, transfers, wallets, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    // Redis в этих тестах не участвует: подменяем добавление в очередь
    jest.spyOn(Queue.prototype, 'add').mockResolvedValue({} as never);

    admin = await createUser('admin@example.com', 'admin');
    bob = await createUser('bob@example.com');
    await http()
      .post('/wallet/deposit')
      .set(bearer(admin.token))
      .send({ amount: 10000 })
      .expect(201);
    await transfer(3000, 'k1').expect(201);
    // итог: у админа 7000, у Боба 3000
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sessions cleanup', () => {
    it('deletes only the expired session', async () => {
      const expired = await insertSession(bob.id, "now() - interval '1 hour'");
      const active = await insertSession(bob.id, "now() + interval '1 day'");

      const deleted = await tasks.cleanupExpiredSessions();

      expect(deleted).toBe(1);
      expect(await sessionExists(expired)).toBe(false);
      expect(await sessionExists(active)).toBe(true);
    });
  });

  describe('balance reconciliation', () => {
    it('finds no mismatches when everything is consistent', async () => {
      const report = await tasks.reconcileBalances();

      expect(report.checkedWallets).toBe(2);
      expect(report.mismatches).toEqual([]);
    });

    it('reports exactly the corrupted wallet and the right difference', async () => {
      const bobWallet = await walletId(bob.id);
      await dataSource.query(
        'UPDATE wallets SET balance = balance + 500 WHERE id = $1',
        [bobWallet],
      );
      const warn = jest.spyOn(Logger.prototype, 'warn');

      const report = await tasks.reconcileBalances();

      expect(report.checkedWallets).toBe(2);
      expect(report.mismatches).toEqual([
        {
          walletId: bobWallet,
          userId: bob.id,
          balance: 3500,
          expected: 3000,
          diff: 500,
        },
      ]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('расхождений 1'),
      );
    });

    it('saves the report to the database', async () => {
      const bobWallet = await walletId(bob.id);
      await dataSource.query(
        'UPDATE wallets SET balance = balance - 100 WHERE id = $1',
        [bobWallet],
      );

      await tasks.reconcileBalances();

      const rows = await dataSource.query(
        'SELECT checked_wallets, mismatches FROM reconciliation_reports',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].checked_wallets).toBe(2);
      expect(rows[0].mismatches).toHaveLength(1);
      expect(rows[0].mismatches[0]).toMatchObject({
        walletId: bobWallet,
        diff: -100,
      });
    });

    it('POST /admin/reconcile returns the report to an admin', async () => {
      const bobWallet = await walletId(bob.id);
      await dataSource.query(
        'UPDATE wallets SET balance = balance + 500 WHERE id = $1',
        [bobWallet],
      );

      const res = await http()
        .post('/admin/reconcile')
        .set(bearer(admin.token))
        .expect(201);

      expect(res.body.checkedWallets).toBe(2);
      expect(res.body.mismatches).toHaveLength(1);
      expect(res.body.mismatches[0]).toMatchObject({
        walletId: bobWallet,
        diff: 500,
      });
    });
  });

  describe('access', () => {
    it('a regular user gets 403 on deposit and on /admin/*', async () => {
      await http()
        .post('/wallet/deposit')
        .set(bearer(bob.token))
        .send({ amount: 100 })
        .expect(403);
      await http().post('/admin/reconcile').set(bearer(bob.token)).expect(403);
      await http()
        .get('/admin/outbox/stats')
        .set(bearer(bob.token))
        .expect(403);
    });

    it('a missing token gets 401', async () => {
      await http().post('/admin/reconcile').expect(401);
      await http().get('/admin/outbox/stats').expect(401);
    });
  });

  describe('outbox stats', () => {
    it('shows the number of unpublished events and the age of the oldest', async () => {
      await dataSource.query('TRUNCATE TABLE outbox_events');
      await transfer(100, 'k2').expect(201);

      const res = await http()
        .get('/admin/outbox/stats')
        .set(bearer(admin.token))
        .expect(200);
      expect(res.body.unpublished).toBe(1);
      expect(res.body.oldestAgeSeconds).toBeGreaterThanOrEqual(0);

      await relay.tick();

      const after = await http()
        .get('/admin/outbox/stats')
        .set(bearer(admin.token))
        .expect(200);
      expect(after.body).toEqual({ unpublished: 0, oldestAgeSeconds: null });
    });
  });
});
