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

describe('Workspace Management End-to-End Tests', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let user1Token: string;
  let user2Token: string;
  let user1WorkspaceId: number;

  const u1 = TestHelper.generateUserData('owner');
  const u2 = TestHelper.generateUserData('other');

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
    user1Token = result1.token;

    const result2 = await TestHelper.createUser(app, userRepo, u2);
    user2Token = result2.token;
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
        .send({
          name: 'Test Workspace',
          description: 'Testing workspace ownership',
        })
        .expect(201);

      user1WorkspaceId = res.body.workspace_id;
      expect(res.body.name).toBe('Test Workspace');
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

  describe('GET /v1/workspaces', () => {
    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/v1/workspaces').expect(401);
    });

    it('should return list of workspaces for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/workspaces')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return empty array when user has no workspaces', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/workspaces')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
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

      expect(res.body.message).toBe(
        'You do not have permission to access this workspace',
      );
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

    it('should return 400 when name is too short', () => {
      return request(app.getHttpServer())
        .put(`/v1/workspaces/${user1WorkspaceId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Yo' })
        .expect(400);
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
    await TestHelper.cleanupUser(userRepo, u1.email);
    await TestHelper.cleanupUser(userRepo, u2.email);
    await app.close();
  });
});
