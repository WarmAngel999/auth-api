import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

jest.setTimeout(30000);

const PASSWORD = 'secret123';
const EMAIL = 'alice@example.com';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const http = () => request(app.getHttpServer());
  const register = (email: string) =>
    http().post('/auth/register').send({ email, password: PASSWORD });
  const login = (email = EMAIL) =>
    http().post('/auth/login').send({ email, password: PASSWORD });
  const refresh = (refreshToken: string) =>
    http().post('/auth/refresh').send({ refreshToken });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    if (dataSource.options.database !== 'auth_test') {
      throw new Error('E2E-тесты должны работать только с базой auth_test');
    }
    await dataSource.query(
      'TRUNCATE TABLE refresh_tokens, users RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('registration', () => {
    it('creates a user and normalizes the email', async () => {
      const res = await register('  Alice@Example.com ').expect(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        email: EMAIL,
        role: 'user',
      });
    });

    it('rejects a duplicate email with 409', async () => {
      await register(EMAIL).expect(409);
    });

    it('rejects a short password with 400', async () => {
      await http()
        .post('/auth/register')
        .send({ email: 'short@example.com', password: '1234567' })
        .expect(400);
    });

    it('rejects unknown fields such as role with 400', async () => {
      await http()
        .post('/auth/register')
        .send({ email: 'evil@example.com', password: PASSWORD, role: 'admin' })
        .expect(400);
    });
  });

  describe('login', () => {
    it('returns access and refresh tokens', async () => {
      const res = await login().expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
    });

    it('is case-insensitive for the email', async () => {
      await login('ALICE@example.com').expect(200);
    });

    it('rejects a wrong password with 401', async () => {
      await http()
        .post('/auth/login')
        .send({ email: EMAIL, password: 'wrong-pass-123' })
        .expect(401);
    });

    it('rejects a non-string password with 400', async () => {
      await http()
        .post('/auth/login')
        .send({ email: EMAIL, password: 123 })
        .expect(400);
    });
  });

  describe('protected routes', () => {
    it('GET /auth/me works with an access token', async () => {
      const { body } = await login().expect(200);
      const res = await http()
        .get('/auth/me')
        .set(bearer(body.accessToken))
        .expect(200);
      expect(res.body).toMatchObject({ email: EMAIL, role: 'user' });
    });

    it('GET /auth/me without a token is 401', async () => {
      await http().get('/auth/me').expect(401);
    });

    it('a refresh token is not accepted as an access token', async () => {
      const { body } = await login().expect(200);
      await http().get('/auth/me').set(bearer(body.refreshToken)).expect(401);
    });
  });

  describe('refresh tokens', () => {
    it('rotates tokens and closes only the session that was reused', async () => {
      const a1 = (await login().expect(200)).body.refreshToken as string;
      const b1 = (await login().expect(200)).body.refreshToken as string;

      await wait(1100); // токены подписываются с точностью до секунды

      const a2 = (await refresh(a1).expect(200)).body.refreshToken as string;
      const b2 = (await refresh(b1).expect(200)).body.refreshToken as string;
      expect(a2).not.toBe(a1);

      await refresh(a1).expect(401); // повторное использование старого токена
      await refresh(a2).expect(401); // сессия A закрыта целиком
      await refresh(b2).expect(200); // сессия B продолжает работать
    });

    it('logout closes the session', async () => {
      const { refreshToken } = (await login().expect(200)).body;
      await http().post('/auth/logout').send({ refreshToken }).expect(200);
      await refresh(refreshToken).expect(401);
    });

    it('logout-all closes every session', async () => {
      const s1 = (await login().expect(200)).body;
      const s2 = (await login().expect(200)).body;

      await http()
        .post('/auth/logout-all')
        .set(bearer(s1.accessToken))
        .expect(200);

      await refresh(s1.refreshToken).expect(401);
      await refresh(s2.refreshToken).expect(401);
    });
  });

  describe('GET /users', () => {
    it('is 401 without a token', async () => {
      await http().get('/users').expect(401);
    });

    it('is 403 for a regular user', async () => {
      const { body } = await login().expect(200);
      await http().get('/users').set(bearer(body.accessToken)).expect(403);
    });

    it('is 200 for an admin and hides password hashes', async () => {
      await dataSource.query(
        "UPDATE users SET role = 'admin' WHERE email = $1",
        [EMAIL],
      );
      const { body } = await login().expect(200); // роль берётся из нового токена
      const res = await http()
        .get('/users')
        .set(bearer(body.accessToken))
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).not.toHaveProperty('passwordHash');
    });
  });
});
