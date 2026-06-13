import { INestApplication } from '@nestjs/common';
import { Repository } from 'typeorm';
import request from 'supertest';
import { User } from '../entities/user-entity';
import { Workspace } from '../entities/workspace-entity';
import { File } from '../entities/file-entity';
import { Chat } from '../entities/chat-entity';

export interface CreatedUser {
  token: string;
  userId: number;
  email: string;
  name: string;
}

export interface CreatedWorkspace {
  workspaceId: number;
}

export interface CreatedFile {
  fileId: number;
}

export class TestHelper {
  static async createUser(
    app: INestApplication,
    userRepo: Repository<User>,
    data: { name: string; email: string; password: string },
  ): Promise<CreatedUser> {
    await request(app.getHttpServer()).post('/v1/auth/register').send(data);
    const user = await userRepo.findOne({ where: { email: data.email } });
    await request(app.getHttpServer())
      .post('/v1/auth/verify')
      .send({ email: data.email, code: user!.verification_code });
    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ name: data.name, password: data.password });
    return {
      token: loginRes.body.token,
      userId: user!.user_id,
      email: data.email,
      name: data.name,
    };
  }

  static async deleteUser(userRepo: Repository<User>, email: string): Promise<void> {
    const user = await userRepo.findOne({ where: { email } });
    if (user) await userRepo.remove(user);
  }

  static async createWorkspace(
    app: INestApplication,
    token: string,
    name: string,
    description = '',
  ): Promise<CreatedWorkspace> {
    const res = await request(app.getHttpServer())
      .post('/v1/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, description });
    return { workspaceId: res.body.workspace_id };
  }

  static async deleteWorkspace(
    workspaceRepo: Repository<Workspace>,
    workspaceId: number,
  ): Promise<void> {
    const workspace = await workspaceRepo.findOne({ where: { workspace_id: workspaceId } });
    if (workspace) await workspaceRepo.remove(workspace);
  }

  static async deleteWorkspacesByUser(
    workspaceRepo: Repository<Workspace>,
    userId: number,
  ): Promise<void> {
    const workspaces = await workspaceRepo.find({ where: { user: { user_id: userId } } });
    if (workspaces.length > 0) await workspaceRepo.remove(workspaces);
  }

  static async uploadFile(
    app: INestApplication,
    token: string,
    workspaceId: number,
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<CreatedFile> {
    const res = await request(app.getHttpServer())
      .post(`/v1/files/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', buffer, { filename, contentType });
    return { fileId: res.body[0]?.file_id };
  }

  static async deleteFile(fileRepo: Repository<File>, fileId: number): Promise<void> {
    const file = await fileRepo.findOne({ where: { file_id: fileId } });
    if (file) await fileRepo.remove(file);
  }

  static async deleteFilesByWorkspace(
    fileRepo: Repository<File>,
    workspaceId: number,
  ): Promise<void> {
    const files = await fileRepo.find({ where: { workspace: { workspace_id: workspaceId } } });
    if (files.length > 0) await fileRepo.remove(files);
  }

  static async deleteChatsByUser(chatRepo: Repository<Chat>, userId: number): Promise<void> {
    const chats = await chatRepo.find({ where: { user: { user_id: userId } } });
    if (chats.length > 0) await chatRepo.remove(chats);
  }

  static async cleanupUser(
    userRepo: Repository<User>,
    email: string,
  ): Promise<void> {
    const user = await userRepo.findOne({ where: { email } });
    if (user) await userRepo.remove(user);
  }

  static generateUserData(prefix = 'test'): { name: string; email: string; password: string } {
    const ts = Date.now();
    return {
      name: `${prefix}_${ts}`,
      email: `${prefix}_${ts}@synapse.com`,
      password: 'SecurePassword123!',
    };
  }
}
