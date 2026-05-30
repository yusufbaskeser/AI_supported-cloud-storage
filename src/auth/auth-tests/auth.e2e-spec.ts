import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user-entity';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';

describe('Auth End-to-End Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  const testUser = {
    name: `user_${Date.now()}`,
    email: `test_${Date.now()}@synapse.com`,
    password: 'Password123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    await app.init();
  }, 30000);

  describe('POST /v1/auth/register', () => {
    it('should successfully register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.message).toBe('Register successful! Please check your email for the verification code.');
    }, 15000);

    it('should fail when registering with an existing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(400);

      expect(res.body.message).toBe('Email already exists');
    });

    it('should fail with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ ...testUser, email: 'invalid-email-format' })
        .expect(400);
    });

    it('should fail with empty body', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({})
        .expect(400);
    });

    it('should fail with missing name', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: testUser.email, password: testUser.password })
        .expect(400);
    });

    it('should fail with short password', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ ...testUser, email: `new_${Date.now()}@synapse.com`, password: '123' })
        .expect(400);
    });
  });

  describe('POST /v1/auth/verify', () => {
    it('should verify account with correct OTP code', async () => {
      const user = await userRepository.findOne({ where: { email: testUser.email } });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({ email: testUser.email, code: user!.verification_code })
        .expect(201);

      expect(res.body.message).toBe('Account verified successfully!');
    });

    it('should fail with incorrect OTP code', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({ email: testUser.email, code: '000000' })
        .expect(401);

      expect(res.body.message).toBe('Invalid code or user not found!');
    });

    it('should fail with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({ email: 'nonexistent@synapse.com', code: '123456' })
        .expect(401);
    });

    it('should fail with empty body', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/verify')
        .send({})
        .expect(400);
    });
  });

  describe('POST /v1/auth/login', () => {
    it('should login successfully and return a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ name: testUser.name, password: testUser.password })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body.message).toBe('Login successful');

      const decoded = jwt.decode(res.body.token);
      expect(decoded).not.toBeNull();
      expect(decoded).toHaveProperty('user_id');
    });

    it('should fail login with incorrect password', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ name: testUser.name, password: 'WrongPassword123' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should fail login with non-existent username', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ name: 'nonexistentuser', password: testUser.password })
        .expect(401);
    });

    it('should fail with empty body', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('POST /v1/auth/forgot-password', () => {
    it('should send a reset link to a registered email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(201);

      expect(res.body.message).toBe('Password reset link sent to your email.');
    });

    it('should fail for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' })
        .expect(404);

      expect(res.body.message).toBe('No user found with that email.');
    });




  });

  describe('POST /v1/auth/reset-password', () => {
    it('should reset password with a valid token', async () => {
      const user = await userRepository.findOne({ where: { email: testUser.email } });

      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: user!.resetPasswordToken,
          newPassword: 'NewSecurePassword999!',
        })
        .expect(201);

      expect(res.body.message).toBe('Password updated successfully.');
    });

    it('should fail with an invalid or expired token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: 'invalid-token-string',
          newPassword: 'SomePassword123',
        })
        .expect(400);

      expect(res.body.message).toBe('Expired or invalid token.');
    });



    it('should fail with short new password', async () => {
      const user = await userRepository.findOne({ where: { email: testUser.email } });

      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: user!.resetPasswordToken,
          newPassword: '123',
        })
        .expect(400);
    });

    it('should fail with empty body', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({})
        .expect(400);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});