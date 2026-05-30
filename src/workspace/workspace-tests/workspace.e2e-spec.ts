import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user-entity';
import { Repository } from 'typeorm';

describe('Workspace Management End-to-End Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let user1Token: string;
  let user2Token: string;
  let user1WorkspaceId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    await app.init();

    const u1 = { name: 'OwnerUser', email: `u1_${Date.now()}@synapse.com`, password: 'Password123!' };
    await request(app.getHttpServer()).post('/v1/auth/register').send(u1);
    const dbU1 = await userRepository.findOne({ where: { email: u1.email } });
    await request(app.getHttpServer()).post('/v1/auth/verify').send({ email: u1.email, code: dbU1!.verification_code });
    const login1 = await request(app.getHttpServer()).post('/v1/auth/login').send({ name: u1.name, password: u1.password });
    user1Token = login1.body.token;

    const u2 = { name: 'OtherUser', email: `u2_${Date.now()}@synapse.com`, password: 'Password123!' };
    await request(app.getHttpServer()).post('/v1/auth/register').send(u2);
    const dbU2 = await userRepository.findOne({ where: { email: u2.email } });
    await request(app.getHttpServer()).post('/v1/auth/verify').send({ email: u2.email, code: dbU2!.verification_code });
    const login2 = await request(app.getHttpServer()).post('/v1/auth/login').send({ name: u2.name, password: u2.password });
    user2Token = login2.body.token;
  }, 40000);

  describe('Security Check', () => {
    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer())
        .post('/v1/workspaces')
        .send({ name: 'Secret Workspace' })
        .expect(401);
    });
  });

  describe('POST /v1/workspaces', () => {
    it('should successfully create a workspace', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/workspaces')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Yusuf Workspace', description: 'Testing workspace ownership' })
        .expect(201);

      user1WorkspaceId = res.body.workspace_id;
      expect(res.body.name).toBe('Yusuf Workspace');
    });

    it('should return 400 with empty body', () => {
      return request(app.getHttpServer())
        .post('/v1/workspaces')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);
    });

    it('should return 400 when name is missing', () => {
      return request(app.getHttpServer())
        .post('/v1/workspaces')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ description: 'No name here' })
        .expect(400);
    });

    it('should return 400 when name is too short', () => {
      return request(app.getHttpServer())
        .post('/v1/workspaces')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Yo' })
        .expect(400);
    });
  });

  describe('GET /v1/workspaces/:id', () => {
    it('should allow owner to fetch workspace by ID', () => {
      return request(app.getHttpServer())
        .get(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);
    });

    it('should return 403 when other user fetches workspace', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(res.body.message).toBe('You do not have permission to access this workspace');
    });

    it('should return 404 for non-existent workspace', () => {
      return request(app.getHttpServer())
        .get('/v1/workspaces/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });
  });

  describe('PUT /v1/workspaces/:id', () => {
    it('should allow owner to update workspace name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Updated Workspace Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Workspace Name');
    });



    it('should return 403 when other user updates workspace', () => {
      return request(app.getHttpServer())
        .put(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should return 404 for non-existent workspace', () => {
      return request(app.getHttpServer())
        .put('/v1/workspaces/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Updated Name' })
        .expect(404);
    });
  });

  describe('DELETE /v1/workspaces/:id', () => {
    it('should return 403 when other user deletes workspace', () => {
      return request(app.getHttpServer())
        .delete(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });

    it('should return 404 for non-existent workspace', () => {
      return request(app.getHttpServer())
        .delete('/v1/workspaces/99999')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should allow owner to delete their own workspace', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.message).toBe('Workspace successfully deleted');
    });

    it('should return 404 when deleting already deleted workspace', () => {
      return request(app.getHttpServer())
        .delete(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});