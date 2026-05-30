import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user-entity';
import { Repository } from 'typeorm';

describe('User Management End-to-End Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let jwtToken: string;
  let secondUserToken: string;
  let createdUserId: number;
  let secondUserId: number;

  const testUser = {
    name: `User_${Date.now()}`,
    email: `user_${Date.now()}@synapse.com`,
    password: 'SecurePassword123!',
  };

  const secondUser = {
    name: `User2_${Date.now()}`,
    email: `user2_${Date.now()}@synapse.com`,
    password: 'SecurePassword123!',
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

    await request(app.getHttpServer()).post('/v1/auth/register').send(testUser);
    const user = await userRepository.findOne({ where: { email: testUser.email } });
    createdUserId = user!.user_id;
    await request(app.getHttpServer()).post('/v1/auth/verify').send({ email: testUser.email, code: user!.verification_code });
    const loginRes = await request(app.getHttpServer()).post('/v1/auth/login').send({ name: testUser.name, password: testUser.password });
    jwtToken = loginRes.body.token;

    await request(app.getHttpServer()).post('/v1/auth/register').send(secondUser);
    const user2 = await userRepository.findOne({ where: { email: secondUser.email } });
    secondUserId = user2!.user_id;
    await request(app.getHttpServer()).post('/v1/auth/verify').send({ email: secondUser.email, code: user2!.verification_code });
    const loginRes2 = await request(app.getHttpServer()).post('/v1/auth/login').send({ name: secondUser.name, password: secondUser.password });
    secondUserToken = loginRes2.body.token;
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
      expect(res.body).toHaveProperty('email', testUser.email);
      expect(res.body).not.toHaveProperty('password');
    });



    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .get('/v1/users/99999')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('User not found');
        });
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





    it('should return 404 when updating non-existent user', () => {
      return request(app.getHttpServer())
        .put('/v1/users/99999')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: 'Someone' })
        .expect(404);
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
    const user2 = await userRepository.findOne({ where: { email: secondUser.email } });
    if (user2) await userRepository.remove(user2);
    await app.close();
  });
});