import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user-entity';
import { Workspace } from '../../entities/workspace-entity';
import { File } from '../../entities/file-entity';
import { AppModule } from '../../app.module';
import * as Minio from 'minio';
import { AITagGenerator } from '../../utils/ai-tag-generator';

jest.mock('minio');
jest.mock('../../utils/ai-tag-generator');

describe('File Management End-to-End Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let workspaceRepository: Repository<Workspace>;
  let fileRepository: Repository<File>;
  let jwtToken: string;
  let secondUserToken: string;
  let workspaceId: number;
  let fileId: number;

  const testUser = {
    name: `FileUser_${Date.now()}`,
    email: `fileuser_${Date.now()}@synapse.com`,
    password: 'SecurePassword123!',
  };

  const secondUser = {
    name: `FileUser2_${Date.now()}`,
    email: `fileuser2_${Date.now()}@synapse.com`,
    password: 'SecurePassword123!',
  };

  const mockMinioClient = {
    putObject: jest.fn().mockResolvedValue({}),
    presignedUrl: jest.fn().mockResolvedValue('https://mock-url.com/file'),
    removeObjects: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    (Minio.Client as jest.Mock).mockImplementation(() => mockMinioClient);
    (AITagGenerator.initialize as jest.Mock).mockImplementation(() => {});
    (AITagGenerator.generateTags as jest.Mock).mockResolvedValue(['test', 'mock', 'tag']);
    (AITagGenerator.getModel as jest.Mock).mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ content: 'false' }),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    workspaceRepository = moduleFixture.get<Repository<Workspace>>(getRepositoryToken(Workspace));
    fileRepository = moduleFixture.get<Repository<File>>(getRepositoryToken(File));

    await app.init();

    await request(app.getHttpServer()).post('/v1/auth/register').send(testUser);
    const user = await userRepository.findOne({ where: { email: testUser.email } });
    await request(app.getHttpServer())
      .post('/v1/auth/verify')
      .send({ email: testUser.email, code: user!.verification_code });
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ name: testUser.name, password: testUser.password });
    jwtToken = loginRes.body.token;

    await request(app.getHttpServer()).post('/v1/auth/register').send(secondUser);
    const user2 = await userRepository.findOne({ where: { email: secondUser.email } });
    await request(app.getHttpServer())
      .post('/v1/auth/verify')
      .send({ email: secondUser.email, code: user2!.verification_code });
    const loginRes2 = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ name: secondUser.name, password: secondUser.password });
    secondUserToken = loginRes2.body.token;

    const workspaceRes = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ name: 'Test Workspace' });
    workspaceId = workspaceRes.body.workspace_id;
  }, 30000);

  describe('Security Check', () => {
    it('should return 401 when accessing endpoints without a token', async () => {
      await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${workspaceId}/files`)
        .expect(401);

      await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .expect(401);

      await request(app.getHttpServer())
        .get('/v1/files/1/url')
        .expect(401);

      await request(app.getHttpServer())
        .put('/v1/files/1')
        .expect(401);

      await request(app.getHttpServer())
        .delete('/v1/files/bulk-delete')
        .expect(401);
    });
  });

  describe('POST /v1/files/workspaces/:workspace_id/files', () => {
    it('should successfully upload a file', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', Buffer.from('mock file content'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('file_id');
      expect(res.body[0]).toHaveProperty('filename', 'test.txt');
      fileId = res.body[0].file_id;
    });

    it('should return 403 when uploading to another user workspace', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .attach('files', Buffer.from('mock file content'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        })
        .expect(403);
    });

    it('should return 404 when uploading to non-existent workspace', async () => {
      await request(app.getHttpServer())
        .post('/v1/files/workspaces/99999/files')
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', Buffer.from('mock file content'), {
          filename: 'test.txt',
          contentType: 'text/plain',
        })
        .expect(404);
    });

   it('should return 400 or 413 when file exceeds 50MB', async () => {
  const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
  await request(app.getHttpServer())
    .post(`/v1/files/workspaces/${workspaceId}/files`)
    .set('Authorization', `Bearer ${jwtToken}`)
    .attach('files', largeBuffer, {
      filename: 'large.txt',
      contentType: 'text/plain',
    })
    .expect((res) => {
      expect([400, 413]).toContain(res.status);
    });
});

    it('should return 400 when file type is not allowed', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', Buffer.from('malicious content'), {
          filename: 'virus.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);
    });

    it('should return 400 when no files are sent', async () => {
      await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });
  });

  describe('GET /v1/files/workspaces/:workspace_id/files', () => {
    it('should successfully return file list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return empty array for workspace with no files', async () => {
      const emptyWorkspaceRes = await request(app.getHttpServer())
        .post('/v1/workspaces')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: 'Empty Workspace' });

      const res = await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${emptyWorkspaceRes.body.workspace_id}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toEqual({ data: [], total: 0, hasMore: false });
    });

    it('should return 403 when accessing another user workspace files', async () => {
      await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent workspace', async () => {
      await request(app.getHttpServer())
        .get('/v1/files/workspaces/99999/files')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });
  });

  describe('GET /v1/files/:file_id/url', () => {
    it('should successfully return a presigned URL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/files/${fileId}/url`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
    });

    it('should return 403 when accessing another user file URL', async () => {
      await request(app.getHttpServer())
        .get(`/v1/files/${fileId}/url`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent file', async () => {
      await request(app.getHttpServer())
        .get('/v1/files/99999/url')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });
  });

  describe('PUT /v1/files/:file_id', () => {
    it('should successfully update filename', async () => {
      const res = await request(app.getHttpServer())
        .put(`/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ filename: 'updated-name.txt' })
        .expect(200);

      expect(res.body).toHaveProperty('filename', 'updated-name.txt');
    });

    it('should return 403 when updating another user file', async () => {
      await request(app.getHttpServer())
        .put(`/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ filename: 'hacked.txt' })
        .expect(403);
    });

    it('should return 404 for non-existent file', async () => {
      await request(app.getHttpServer())
        .put('/v1/files/99999')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ filename: 'test.txt' })
        .expect(404);
    });

    it('should return 400 when filename is empty', async () => {
      await request(app.getHttpServer())
        .put(`/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ filename: '' })
        .expect(400);
    });

    it('should return 400 when filename exceeds 255 characters', async () => {
      await request(app.getHttpServer())
        .put(`/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ filename: 'a'.repeat(256) })
        .expect(400);
    });
  });

  describe('DELETE /v1/files/bulk-delete', () => {
    let bulkFileId: number;

   beforeEach(async () => {
  const res = await request(app.getHttpServer())
    .post(`/v1/files/workspaces/${workspaceId}/files`)
    .set('Authorization', `Bearer ${jwtToken}`)
    .attach('files', Buffer.from('mock file content'), {
      filename: 'to-delete.txt',
      contentType: 'text/plain',
    });
  bulkFileId = res.body[0]?.file_id;
  expect(bulkFileId).toBeDefined();
});

    it('should successfully delete files', async () => {
      const res = await request(app.getHttpServer())
        .delete('/v1/files/bulk-delete')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ file_ids: [bulkFileId] })
        .expect(200);

      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('deleted successfully');
    });

    it('should return 403 when deleting another user files', async () => {
      await request(app.getHttpServer())
        .delete('/v1/files/bulk-delete')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({ file_ids: [bulkFileId] })
        .expect(403);
    });

    it('should return message when file_ids array is empty', async () => {
      const res = await request(app.getHttpServer())
        .delete('/v1/files/bulk-delete')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ file_ids: [] })
        .expect(200);

      expect(res.body.message).toBe('No file IDs provided');
    });

    it('should return message when file_ids do not exist', async () => {
      const res = await request(app.getHttpServer())
        .delete('/v1/files/bulk-delete')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ file_ids: [99999, 99998] })
        .expect(200);

      expect(res.body.message).toBe('No files found in database');
    });
  });

 afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const files = await fileRepository.find();
  if (files.length > 0) await fileRepository.remove(files);

  const workspaces = await workspaceRepository.find();
  if (workspaces.length > 0) await workspaceRepository.remove(workspaces);

  const user1 = await userRepository.findOne({ where: { email: testUser.email } });
  if (user1) await userRepository.remove(user1);

  const user2 = await userRepository.findOne({ where: { email: secondUser.email } });
  if (user2) await userRepository.remove(user2);

  await app.close();
},15000);
});