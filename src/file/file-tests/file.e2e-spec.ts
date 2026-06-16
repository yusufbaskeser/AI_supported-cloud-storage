import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user-entity';
import { AppModule } from '../../app.module';
import * as Minio from 'minio';
import { AITagGenerator } from '../../utils/ai-tag-generator';
import { TestHelper } from '../../test-utils/test-helper';

jest.mock('minio');
jest.mock('../../utils/ai-tag-generator');

describe('File Management End-to-End Tests', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let jwtToken: string;
  let secondUserToken: string;
  let workspaceId: number;
  let fileId: number;

  const u1 = TestHelper.generateUserData('fileuser1');
  const u2 = TestHelper.generateUserData('fileuser2');

  const mockMinioClient = {
    putObject: jest.fn().mockResolvedValue({}),
    presignedUrl: jest.fn().mockResolvedValue('https://mock-url.com/file'),
    removeObjects: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    (Minio.Client as jest.Mock).mockImplementation(() => mockMinioClient);
    (AITagGenerator.initialize as jest.Mock).mockImplementation(() => {});
    (AITagGenerator.generateTags as jest.Mock).mockResolvedValue([
      'test',
      'mock',
      'tag',
    ]);
    (AITagGenerator.getModel as jest.Mock).mockReturnValue({
      invoke: jest.fn().mockResolvedValue({ content: 'false' }),
    });

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

    const result2 = await TestHelper.createUser(app, userRepo, u2);
    secondUserToken = result2.token;

    const ws = await TestHelper.createWorkspace(
      app,
      jwtToken,
      'Test Workspace',
    );
    workspaceId = ws.workspaceId;
  }, 30000);

  describe('Security Check', () => {
    it('should return 401 when accessing endpoints without a token', async () => {
      await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${workspaceId}/files`)
        .expect(401);

      await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .expect(401);

      await request(app.getHttpServer()).get('/v1/files/1/url').expect(401);

      await request(app.getHttpServer()).put('/v1/files/1').expect(401);

      await request(app.getHttpServer())
        .delete('/v1/files/bulk-delete')
        .expect(401);
    });
  });

  describe('POST /v1/files/workspaces/:workspace_id/files', () => {
    it('should successfully upload a file', async () => {
      const { fileId: id } = await TestHelper.uploadFile(
        app,
        jwtToken,
        workspaceId,
        Buffer.from('mock file content'),
        'test.txt',
        'text/plain',
      );
      expect(id).toBeDefined();
      fileId = id;
    });

    it('should successfully upload multiple files at once', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', Buffer.from('file one content'), {
          filename: 'file1.txt',
          contentType: 'text/plain',
        })
        .attach('files', Buffer.from('file two content'), {
          filename: 'file2.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should skip unsafe image detected by content safety check', async () => {
      (AITagGenerator.getModel as jest.Mock).mockReturnValueOnce({
        invoke: jest.fn().mockResolvedValue({ content: 'true' }),
      });

      const res = await request(app.getHttpServer())
        .post(`/v1/files/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .attach('files', Buffer.from('fake image data'), {
          filename: 'unsafe-image.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
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

    it('should return paginated results with correct structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${workspaceId}/files?page=1&limit=1`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('hasMore');
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for workspace with no files', async () => {
      const { workspaceId: emptyWsId } = await TestHelper.createWorkspace(
        app,
        jwtToken,
        'Empty Workspace',
      );

      const res = await request(app.getHttpServer())
        .get(`/v1/files/workspaces/${emptyWsId}/files`)
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

  describe('GET /v1/files/:file_id/download', () => {
    it('should successfully return a download URL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/files/${fileId}/download`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
    });

    it('should return 403 when accessing another user file download URL', async () => {
      await request(app.getHttpServer())
        .get(`/v1/files/${fileId}/download`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent file', async () => {
      await request(app.getHttpServer())
        .get('/v1/files/99999/download')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });
  });

  describe('GET /v1/files/:file_id/share', () => {
    it('should successfully return a shareable link with expiry', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/files/${fileId}/share?expiry=3600`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('expires_at');
    });

    it('should return 403 when generating share URL for another user file', async () => {
      await request(app.getHttpServer())
        .get(`/v1/files/${fileId}/share`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);
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
      const { fileId: id } = await TestHelper.uploadFile(
        app,
        jwtToken,
        workspaceId,
        Buffer.from('mock file content'),
        'to-delete.txt',
        'text/plain',
      );
      bulkFileId = id;
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await TestHelper.cleanupUser(userRepo, u1.email);
    await TestHelper.cleanupUser(userRepo, u2.email);
    await app.close();
  }, 15000);
});
