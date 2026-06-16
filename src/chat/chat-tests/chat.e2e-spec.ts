import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { JwtAuthGuard } from '../../guard/jwt-auth-guard';
import { ChatService } from '../chat-service';

jest.setTimeout(120000);

describe('Chat Controller (Integration)', () => {
  let app: INestApplication;
  let secureApp: INestApplication;
  let chatService: ChatService;

  const mockUser = { user_id: 1, name: 'John Doe', email: 'john@example.com' };
  const mockFiles = [
    {
      file_id: 1,
      filename: 'landscape.jpg',
      tags: ['nature', 'photo'],
      size: 2097152,
    },
    {
      file_id: 2,
      filename: 'report.pdf',
      mime_type: 'application/pdf',
      size: 524288,
    },
  ];

  beforeAll(async () => {
    const secureFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    secureApp = secureFixture.createNestApplication();
    secureApp.enableVersioning({ type: VersioningType.URI });
    secureApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await secureApp.init();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    try {
      chatService = app.get<ChatService>(ChatService);
    } catch (e) {
      const { ChatModule } = await import('../chat-module.js');
      chatService = moduleFixture.select(ChatModule).get(ChatService);
    }

    jest.spyOn(chatService as any, 'getUserInfo').mockResolvedValue(mockUser);
    jest.spyOn(chatService as any, 'saveMessage').mockResolvedValue(undefined);
  });

  const sendChatMessage = (msg: string) => {
    return request(app.getHttpServer())
      .post('/v1/chat/message')
      .set('Authorization', 'Bearer fake-token')
      .send({ message: msg });
  };

  describe('Security Check', () => {
    it('should return 401 when no token is provided', async () => {
      await request(secureApp.getHttpServer())
        .post('/v1/chat/message')
        .send({ message: 'hello' })
        .expect(401);
    });
  });

  describe('POST /chat/message', () => {
    it('should return 400 when message is empty', async () => {
      await request(app.getHttpServer())
        .post('/v1/chat/message')
        .set('Authorization', 'Bearer fake-token')
        .send({ message: '' })
        .expect(400);
    });

    it('should return 400 when message field is missing', async () => {
      await request(app.getHttpServer())
        .post('/v1/chat/message')
        .set('Authorization', 'Bearer fake-token')
        .send({})
        .expect(400);
    });

    it('should return a general AI response for a basic message', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'Hello!',
        action: 'general',
      });

      const res = await sendChatMessage('Hello, how are you?');
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('general');
    });

    it('should trigger tag-based search for "nature photos"', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'Found files',
        action: 'search_files',
        files: [mockFiles[0]],
      });

      const res = await sendChatMessage('Find my nature photos');
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('search_files');
      expect(res.body.files.length).toBeGreaterThan(0);
    });

    it('should return file statistics when asked', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'You have 2 files.',
        action: 'stats',
        stats: { total_files: 2, total_size_mb: '2.50' },
      });

      const res = await sendChatMessage('How many files do I have?');
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('stats');
      expect(res.body.stats.total_files).toBe(2);
    });

    it('should create a new workspace when requested', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'Workspace "Work" created.',
        action: 'general',
      });

      const res = await sendChatMessage('Create a workspace named "Work"');
      expect(res.status).toBe(201);
      expect(res.body.reply).toContain('Work');
    });

    it('should find large files over 50MB', async () => {
      const largeFile = {
        file_id: 3,
        filename: 'video.mp4',
        size: 100 * 1024 * 1024,
      };

      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'Found large files',
        action: 'search_files',
        files: [largeFile],
      });

      const res = await sendChatMessage('Find my large files');
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('search_files');
      expect(res.body.files[0].size).toBeGreaterThan(50 * 1024 * 1024);
    });

    it('should return next result when user asks for another file', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'Here is another file.',
        action: 'search_files',
        files: [mockFiles[1]],
      });

      const res = await sendChatMessage('Show me another one');
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('search_files');
      expect(res.body.files.length).toBeGreaterThan(0);
    });

    it('should return files marked for deletion with confirmation action', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'The following files will be deleted. Please confirm.',
        action: 'delete_files',
        files: [mockFiles[0]],
      });

      const res = await sendChatMessage('Delete my nature photos');
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('delete_files');
      expect(res.body.files.length).toBeGreaterThan(0);
    });

    it('should return a file for link generation', async () => {
      jest.spyOn(chatService, 'handleMessage').mockResolvedValueOnce({
        reply: 'Generating a shareable link for your file.',
        action: 'generate_link',
        files: [
          { file_id: mockFiles[0].file_id, filename: mockFiles[0].filename },
        ],
      });

      const res = await sendChatMessage(
        'Generate a link for my landscape photo',
      );
      expect(res.status).toBe(201);
      expect(res.body.action).toBe('generate_link');
      expect(res.body.files.length).toBeGreaterThan(0);
    });
  });

  afterAll(async () => {
    if (secureApp) await secureApp.close();
    if (app) await app.close();
  });
});
