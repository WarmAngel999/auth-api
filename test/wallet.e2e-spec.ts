import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

jest.setTimeout(30000);

const PASSWORD = 'secret123';

describe('Wallet (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let alice: { id: number; token: string };
  let bob: { id: number; token: string };

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createUser = async (email: string) => {
    await http().post('/auth/register').send({ email, password: PASSWORD });
    const res = await http().post('/auth/login').send({ email, password: PASSWORD });
    const token = res.body.accessToken as string;
    if (!token) throw new Error('login did not return accessToken');
    const [row] = await dataSource.query('SELECT id FROM users WHERE email = $1', [email]);
    return { id: row.id as number, token };
  };

  const deposit = (token: string, amount: number) =>
    http().post('/wallet/deposit').set(bearer(token)).send({ amount });

  const transfer = (token: string, toUserId: number, amount: number, key?: string) => {
    const req = http().post('/wallet/transfer').set(bearer(token)).send({ toUserId, amount });
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
    if (dataSource.options.database !== 'auth_test') {
      throw new Error('E2E-тесты должны работать только с базой auth_test');
    }
    // пересоздаём схему по entity (в базе auth_test, проверено выше)
    await dataSource.synchronize(true);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE transfers, wallets, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
    alice = await createUser('alice@example.com');
    bob = await createUser('bob@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('deposit', () => {
    it('increases the balance and writes a journal entry', async () => {
      await deposit(alice.token, 10000).expect(201);
      expect(await balance(alice.token)).toBe(10000);

      const res = await http().get('/wallet/transactions').set(bearer(alice.token));
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ type: 'deposit', direction: 'in', amount: 10000 });
    });

    it('rejects negative, zero and fractional amounts with 400', async () => {
      await deposit(alice.token, -5).expect(400);
      await deposit(alice.token, 0).expect(400);
      await deposit(alice.token, 1.5).expect(400);
    });

    it('requires a token', async () => {
      await http().post('/wallet/deposit').send({ amount: 100 }).expect(401);
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

      const a = await http().get('/wallet/transactions').set(bearer(alice.token));
      const b = await http().get('/wallet/transactions').set(bearer(bob.token));
      expect(a.body[0]).toMatchObject({ type: 'transfer', direction: 'out', amount: 3000 });
      expect(b.body[0]).toMatchObject({ type: 'transfer', direction: 'in', amount: 3000 });
    });

    it('rejects an amount above the balance and changes nothing', async () => {
      await transfer(alice.token, bob.id, 10001, 'k1').expect(400);
      expect(await balance(alice.token)).toBe(10000);
      expect(await balance(bob.token)).toBe(0);
    });

    it('does not charge twice for a repeated idempotency key', async () => {
      const first = await transfer(alice.token, bob.id, 3000, 'k1').expect(201);
      const second = await transfer(alice.token, bob.id, 3000, 'k1').expect(201);

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
        Array.from({ length: 10 }, () => transfer(alice.token, bob.id, 5000, 'same-key')),
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
        Array.from({ length: 10 }, (_, i) => transfer(alice.token, bob.id, 3000, `key-${i}`)),
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
});
