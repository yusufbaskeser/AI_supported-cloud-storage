import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user-entity';
import { Repository } from 'typeorm';
import { TestHelper } from '../../test-utils/test-helper';

describe('User Management End-to-End Tests', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let jwtToken: string;
  let secondUserToken: string;
  let createdUserId: number;

  const u1 = TestHelper.generateUserData('user1');
  const u2 = TestHelper.generateUserData('user2');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    await app.init();

    const result1 = await TestHelper.createUser(app, userRepo, u1);
    jwtToken = result1.token;
    createdUserId = result1.userId;

    const result2 = await TestHelper.createUser(app, userRepo, u2);
    secondUserToken = result2.token;
  }, 30000);

  describe('Security Check', () => {
    it('should return 401 when accessing endpoints without a token', () => {
      return request(app.getHttpServer())
        .get(`/v1/users/${createdUserId}`)
        .expect(401);
    });
  });

  describe('GET /v1/users/:id', () => {
    it('should successfully return user profile data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('user_id', createdUserId);
      expect(res.body).toHaveProperty('email', u1.email);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 403 when accessing another user profile', () => {
      return request(app.getHttpServer())
        .get('/v1/users/99999')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(403);
    });
  });

  describe('PUT /v1/users/:id', () => {
    it('should successfully update user name and password', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: 'UpdatedName', password: 'NewSecurePassword123' })
        .expect(200);

      expect(res.body.message).toBe('User updated successfully');
    });

    it('should return 400 for password shorter than 8 characters', () => {
      return request(app.getHttpServer())
        .put(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ password: '123' })
        .expect(400);
    });

    it('should return 400 when name is shorter than 3 characters', () => {
      return request(app.getHttpServer())
        .put(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: 'Yo' })
        .expect(400);
    });

    it('should return 200 when updating with empty body since all fields are optional', () => {
      return request(app.getHttpServer())
        .put(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({})
        .expect(200);
    });

    it('should return 403 when updating another user profile', () => {
      return request(app.getHttpServer())
        .put('/v1/users/99999')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: 'Someone' })
        .expect(403);
    });
  });

  describe('DELETE /v1/users/:id', () => {
    it('should successfully delete the user', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body.message).toBe('User deleted successfully');
    });

    it('should return 404 when deleting a user that is already gone', () => {
      return request(app.getHttpServer())
        .delete(`/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });
  });

  afterAll(async () => {
    await TestHelper.cleanupUser(userRepo, u1.email);
    await TestHelper.cleanupUser(userRepo, u2.email);
    await app.close();
  });
});
