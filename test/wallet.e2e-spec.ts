import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { HistoryCache } from '../src/cache/history-cache.service';

jest.setTimeout(30000);

const PASSWORD = 'secret123';

describe('Wallet (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let historyCache: HistoryCache;
  let alice: { id: number; token: string };
  let bob: { id: number; token: string };

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createUser = async (email: string, role: 'user' | 'admin' = 'user') => {
    await http().post('/auth/register').send({ email, password: PASSWORD });
    if (role === 'admin') {
      await dataSource.query('UPDATE users SET role = $1 WHERE email = $2', [
        role,
        email,
      ]);
    }
    const res = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    const token = res.body.accessToken as string;
    if (!token) throw new Error('login did not return accessToken');
    const [row] = await dataSource.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    return { id: row.id as number, token };
  };

  const deposit = (token: string, amount: number) =>
    http().post('/wallet/deposit').set(bearer(token)).send({ amount });

  const transfer = (
    token: string,
    toUserId: number,
    amount: number,
    key?: string,
  ) => {
    const req = http()
      .post('/wallet/transfer')
      .set(bearer(token))
      .send({ toUserId, amount });
    return key ? req.set('Idempotency-Key', key) : req;
  };

  const balance = async (token: string) => {
    const res = await http().get('/wallet').set(bearer(token));
    return res.body.balance as number;
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
    historyCache = app.get(HistoryCache);
    if (dataSource.options.database !== 'auth_test') {
      throw new Error('E2E-тесты должны работать только с базой auth_test');
    }
  });

  beforeEach(async () => {
    await historyCache.flush();
    await dataSource.query(
      'TRUNCATE TABLE outbox_events, transfers, wallets, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    alice = await createUser('alice@example.com', 'admin');
    bob = await createUser('bob@example.com', 'admin');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('deposit', () => {
    it('is forbidden for a regular user with 403', async () => {
      const carol = await createUser('carol@example.com');
      await deposit(carol.token, 1000).expect(403);
      expect(await balance(carol.token)).toBe(0);
    });
    it('increases the balance and writes a journal entry', async () => {
      await deposit(alice.token, 10000).expect(201);
      expect(await balance(alice.token)).toBe(10000);

      const res = await http()
        .get('/wallet/transactions')
        .set(bearer(alice.token));
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        type: 'deposit',
        direction: 'in',
        amount: 10000,
      });
      expect(res.body.items[0]).not.toHaveProperty('counterparty');
    });

    it('rejects negative, zero and fractional amounts with 400', async () => {
      await deposit(alice.token, -5).expect(400);
      await deposit(alice.token, 0).expect(400);
      await deposit(alice.token, 1.5).expect(400);
    });

    it('requires a token', async () => {
      await http().post('/wallet/deposit').send({ amount: 100 }).expect(401);
    });
    it('database rejects a transfer to the same wallet', async () => {
      await deposit(alice.token, 1000).expect(201);
      const [{ id: walletId }] = await dataSource.query(
        'SELECT id FROM wallets WHERE user_id = $1',
        [alice.id],
      );
      await expect(
        dataSource.query(
          `INSERT INTO transfers (from_wallet_id, to_wallet_id, type, amount, idempotency_key)
       VALUES ($1, $1, 'transfer', 100, 'self')`,
          [walletId],
        ),
      ).rejects.toThrow(/chk_transfers_no_self/);
    });
  });

  describe('transfer', () => {
    beforeEach(async () => {
      await deposit(alice.token, 10000).expect(201);
    });

    it('moves money and shows the entry to both sides', async () => {
      await transfer(alice.token, bob.id, 3000, 'k1').expect(201);

      expect(await balance(alice.token)).toBe(7000);
      expect(await balance(bob.token)).toBe(3000);

      const a = await http()
        .get('/wallet/transactions')
        .set(bearer(alice.token));
      const b = await http().get('/wallet/transactions').set(bearer(bob.token));
      expect(a.body.items[0]).toMatchObject({
        type: 'transfer',
        direction: 'out',
        amount: 3000,
      });
      expect(b.body.items[0]).toMatchObject({
        type: 'transfer',
        direction: 'in',
        amount: 3000,
      });
      expect(a.body.items[0]).toMatchObject({
        direction: 'out',
        counterpartyUserId: bob.id,
      });
      expect(b.body.items[0]).toMatchObject({
        direction: 'in',
        counterpartyUserId: alice.id,
      });
    });

    it('rejects an amount above the balance and changes nothing', async () => {
      await transfer(alice.token, bob.id, 10001, 'k1').expect(400);
      expect(await balance(alice.token)).toBe(10000);
      expect(await balance(bob.token)).toBe(0);
    });

    it('does not charge twice for a repeated idempotency key', async () => {
      const first = await transfer(alice.token, bob.id, 3000, 'k1').expect(201);
      const second = await transfer(alice.token, bob.id, 3000, 'k1').expect(
        201,
      );

      expect(second.body.id).toBe(first.body.id);
      expect(await balance(alice.token)).toBe(7000);
      expect(await balance(bob.token)).toBe(3000);
    });

    it('rejects the same key with different data with 409', async () => {
      await transfer(alice.token, bob.id, 3000, 'k1').expect(201);
      await transfer(alice.token, bob.id, 9999, 'k1').expect(409);
      expect(await balance(alice.token)).toBe(7000);
    });

    it('validates input', async () => {
      await transfer(alice.token, bob.id, 100).expect(400); // нет ключа
      await transfer(alice.token, alice.id, 100, 'k1').expect(400); // самому себе
      await transfer(alice.token, 999999, 100, 'k2').expect(404); // нет получателя
      await transfer(alice.token, bob.id, 0, 'k3').expect(400);
      await transfer(alice.token, bob.id, 1.5, 'k4').expect(400);
    });
  });

  describe('concurrency', () => {
    it('10 parallel requests with one key charge exactly once', async () => {
      await deposit(alice.token, 10000).expect(201);

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          transfer(alice.token, bob.id, 5000, 'same-key'),
        ),
      );

      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect(await balance(alice.token)).toBe(5000);
      expect(await balance(bob.token)).toBe(5000);

      const [{ count }] = await dataSource.query(
        "SELECT count(*)::int AS count FROM transfers WHERE type = 'transfer'",
      );
      expect(count).toBe(1);
    });

    it('never lets the balance go negative with different keys', async () => {
      await deposit(alice.token, 10000).expect(201);

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          transfer(alice.token, bob.id, 3000, `key-${i}`),
        ),
      );

      const ok = results.filter((r) => r.status === 201).length;
      const rejected = results.filter((r) => r.status === 400).length;
      expect(ok).toBe(3);
      expect(rejected).toBe(7);
      expect(await balance(alice.token)).toBe(1000);
      expect(await balance(bob.token)).toBe(9000);
    });

    it('opposite transfers at the same time do not deadlock', async () => {
      await deposit(alice.token, 10000).expect(201);
      await deposit(bob.token, 10000).expect(201);

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0
            ? transfer(alice.token, bob.id, 100, `a-${i}`)
            : transfer(bob.token, alice.id, 100, `b-${i}`),
        ),
      );

      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(await balance(alice.token)).toBe(10000);
      expect(await balance(bob.token)).toBe(10000);
    });
  });
  describe('history pagination', () => {
    const page = (token: string, limit?: number, cursor?: string | null) => {
      const query: Record<string, string | number> = {};
      if (limit !== undefined) query.limit = limit;
      if (cursor) query.cursor = cursor;
      return http().get('/wallet/transactions').query(query).set(bearer(token));
    };

    // у Alice 6 записей: 1 пополнение и 5 переводов Bob
    beforeEach(async () => {
      await deposit(alice.token, 10000).expect(201);
      for (let i = 0; i < 5; i++) {
        await transfer(alice.token, bob.id, 100, `p-${i}`).expect(201);
      }
    });

    it('pages go without gaps and repeats', async () => {
      const full = await page(alice.token, 100).expect(200);
      const allIds: number[] = full.body.items.map((x: { id: number }) => x.id);
      expect(allIds).toHaveLength(6);

      const collected: number[] = [];
      let cursor: string | null = null;
      let guard = 0;
      do {
        const res: {
          body: { items: { id: number }[]; nextCursor: string | null };
        } = await page(alice.token, 2, cursor).expect(200);
        collected.push(...res.body.items.map((x) => x.id));
        cursor = res.body.nextCursor;
      } while (cursor && ++guard < 10);

      expect(collected).toEqual(allIds);
      expect(new Set(collected).size).toBe(collected.length);
    });

    it('the last page has nextCursor = null', async () => {
      const res = await page(alice.token, 100).expect(200);
      expect(res.body.items).toHaveLength(6);
      expect(res.body.nextCursor).toBeNull();
    });

    it('nextCursor is null when the page fits exactly', async () => {
      const res = await page(alice.token, 6).expect(200);
      expect(res.body.items).toHaveLength(6);
      expect(res.body.nextCursor).toBeNull();
    });

    it('rejects an invalid limit or cursor with 400', async () => {
      await page(alice.token, 0).expect(400);
      await page(alice.token, -1).expect(400);
      await http()
        .get('/wallet/transactions?limit=abc')
        .set(bearer(alice.token))
        .expect(400);
      await page(alice.token, 2, 'not-a-cursor').expect(400);
    });
  });
  describe('history cache', () => {
    const history = (token: string) =>
      http().get('/wallet/transactions').set(bearer(token)).expect(200);

    it('a second read does not query the database', async () => {
      await deposit(alice.token, 1000).expect(201);
      const spy = jest.spyOn(dataSource, 'query');
      const historyQueries = () =>
        spy.mock.calls.filter(([sql]) => String(sql).includes('UNION ALL'))
          .length;

      await history(alice.token);
      await history(alice.token);

      expect(historyQueries()).toBe(1);
      spy.mockRestore();
    });

    it('a deposit is visible right after it', async () => {
      expect((await history(alice.token)).body.items).toHaveLength(0);
      await deposit(alice.token, 1000).expect(201);
      expect((await history(alice.token)).body.items).toHaveLength(1);
    });

    it('a transfer resets the cache of both sides', async () => {
      await deposit(alice.token, 10000).expect(201);
      await history(alice.token);
      await history(bob.token);

      await transfer(alice.token, bob.id, 3000, 'k1').expect(201);

      const a = await history(alice.token);
      const b = await history(bob.token);
      expect(a.body.items).toHaveLength(2);
      expect(b.body.items).toHaveLength(1);
      expect(b.body.items[0]).toMatchObject({ direction: 'in', amount: 3000 });
    });
  });
});
