import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan } from 'typeorm';
import type { Client as MinioClient } from 'minio';
import { createMinioClient } from '../utils/minio-client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { User, UserRole } from '../entities/user-entity';
import { File } from '../entities/file-entity';
import { Workspace } from '../entities/workspace-entity';
import { Chat } from '../entities/chat-entity';

@Injectable()
export class AdminService {
  private minioClient: MinioClient;
  private bucketName: string;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(Chat) private chatRepo: Repository<Chat>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.minioClient = createMinioClient();
    this.bucketName = process.env.MINIO_BUCKET!;
  }

  private omitPassword(user: User) {
    const { password, resetPasswordToken, verification_code, ...safe } = user;
    return safe;
  }

  private async deleteFilesFromStorage(files: File[]) {
    if (files.length === 0) return;
    const paths = files.map((f) => f.minio_path);
    await this.minioClient.removeObjects(this.bucketName, paths);
    await this.fileRepo.remove(files);
  }

  async getSystemStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalFiles,
      totalWorkspaces,
      newUsersToday,
      newUsersWeek,
    ] = await Promise.all([
      this.userRepo.count(),
      this.fileRepo.count(),
      this.workspaceRepo.count(),
      this.userRepo.count({ where: { created_at: MoreThan(oneDayAgo) } }),
      this.userRepo.count({ where: { created_at: MoreThan(oneWeekAgo) } }),
    ]);

    const raw = await this.fileRepo
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.size), 0)', 'totalSize')
      .getRawOne<{ totalSize: string }>();
    const globalTotalSize = Number(raw?.totalSize ?? 0);

    const topUsersByStorage = await this.userRepo.find({
      select: ['user_id', 'name', 'email', 'usedStorage', 'storageLimit'],
      order: { usedStorage: 'DESC' },
      take: 5,
    });

    return {
      totalUsers,
      totalFiles,
      totalWorkspaces,
      newUsersToday,
      newUsersWeek,
      globalTotalSize_GB: (globalTotalSize / 1024 ** 3).toFixed(3),
      topUsersByStorage,
    };
  }

  async findAllUsers(
    page = 1,
    limit = 20,
    filters?: {
      dateFilter?: 'today' | 'week' | 'month';
      minWorkspaces?: number;
      maxWorkspaces?: number;
      hasFiles?: 'yes' | 'no';
      search?: string;
    },
  ) {
    const buildQb = () => {
      const qb = this.userRepo
        .createQueryBuilder('u')
        .leftJoin('u.workspaces', 'ws')
        .leftJoin('ws.files', 'f')
        .groupBy('u.user_id');

      if (filters?.search) {
        qb.andWhere('(u.name LIKE :q OR u.email LIKE :q)', {
          q: `%${filters.search}%`,
        });
      }
      if (filters?.dateFilter) {
        const now = Date.now();
        const from =
          filters.dateFilter === 'today'
            ? new Date(new Date().setHours(0, 0, 0, 0))
            : filters.dateFilter === 'week'
              ? new Date(now - 7 * 24 * 60 * 60 * 1000)
              : new Date(now - 30 * 24 * 60 * 60 * 1000);
        qb.andWhere('u.created_at >= :from', { from });
      }

      let firstHaving = true;
      const having = (clause: string, params?: object) => {
        if (firstHaving) {
          qb.having(clause, params);
          firstHaving = false;
        } else qb.andHaving(clause, params);
      };

      if (filters?.minWorkspaces !== undefined)
        having('COUNT(DISTINCT ws.workspace_id) >= :minWs', {
          minWs: filters.minWorkspaces,
        });
      if (filters?.maxWorkspaces !== undefined)
        having('COUNT(DISTINCT ws.workspace_id) <= :maxWs', {
          maxWs: filters.maxWorkspaces,
        });
      if (filters?.hasFiles === 'yes') having('COUNT(DISTINCT f.file_id) > 0');
      else if (filters?.hasFiles === 'no')
        having('COUNT(DISTINCT f.file_id) = 0');

      return qb;
    };

    const idsOnly = await buildQb().select('u.user_id', 'uid').getRawMany();
    const total = idsOnly.length;

    const data = await buildQb()
      .select([
        'u.user_id',
        'u.name',
        'u.email',
        'u.created_at',
        'u.role',
        'u.usedStorage',
        'u.storageLimit',
        'u.is_verified',
        'u.profile_photo',
      ])
      .addSelect('COUNT(DISTINCT ws.workspace_id)', 'workspaceCount')
      .addSelect('COUNT(DISTINCT f.file_id)', 'fileCount')
      .orderBy('u.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    return {
      data: data.map((u) => ({
        user_id: u.u_user_id,
        name: u.u_name,
        email: u.u_email,
        created_at: u.u_created_at,
        role: u.u_role,
        usedStorage: u.u_usedStorage,
        storageLimit: u.u_storageLimit,
        is_verified: u.u_is_verified,
        profile_photo: u.u_profile_photo,
        workspaceCount: parseInt(u.workspaceCount) || 0,
        fileCount: parseInt(u.fileCount) || 0,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchUsers(query: string) {
    const users = await this.userRepo.find({
      where: [{ email: Like(`%${query}%`) }, { name: Like(`%${query}%`) }],
    });
    return users.map((u) => this.omitPassword(u));
  }

  async findUserDetail(id: number) {
    const user = await this.userRepo.findOne({
      where: { user_id: id },
      relations: ['workspaces', 'workspaces.files'],
    });
    if (!user) throw new NotFoundException('User not found');
    const userTotalSize = user.workspaces.reduce(
      (s, ws) => s + (ws.files ?? []).reduce((a, f) => a + Number(f.size), 0),
      0,
    );
    const { password, resetPasswordToken, verification_code, ...safe } = user;
    return {
      ...safe,
      userTotalSize_MB: (userTotalSize / 1024 ** 2).toFixed(2),
    };
  }

  async changeUserRole(id: number, newRole: UserRole) {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(id, { role: newRole });
    return { message: `Role updated to ${newRole}` };
  }

  async updateStorageLimit(id: number, limitBytes: number) {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(id, { storageLimit: limitBytes });
    return {
      message: 'Storage limit updated',
      storageLimit_GB: (limitBytes / 1024 ** 3).toFixed(2),
    };
  }

  async verifyUser(id: number) {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(id, {
      is_verified: true,
      verification_code: null,
      verification_code_expires: null,
    });
    return { message: 'User verified successfully' };
  }

  async deleteUser(id: number) {
    const user = await this.userRepo.findOne({ where: { user_id: id } });
    if (!user) throw new NotFoundException('User not found');

    const files = await this.fileRepo
      .createQueryBuilder('f')
      .innerJoin('f.workspace', 'w')
      .innerJoin('w.user', 'u')
      .where('u.user_id = :id', { id })
      .getMany();

    if (files.length > 0) {
      await this.minioClient.removeObjects(
        this.bucketName,
        files.map((f) => f.minio_path),
      );
    }

    await this.userRepo.delete(id);
    return { message: 'User deleted' };
  }

  async findWorkspacesByUser(userId: number) {
    return this.workspaceRepo.find({
      where: { user: { user_id: userId } },
      relations: ['files'],
    });
  }

  async findAllWorkspaces(page = 1, limit = 20) {
    const [workspaces, total] = await this.workspaceRepo.findAndCount({
      relations: ['user', 'files'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: workspaces.map((ws) => ({
        workspace_id: ws.workspace_id,
        name: ws.name,
        description: ws.description,
        created_at: ws.created_at,
        fileCount: ws.files?.length ?? 0,
        owner: ws.user
          ? {
              user_id: ws.user.user_id,
              name: ws.user.name,
              email: ws.user.email,
            }
          : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async forceDeleteWorkspace(id: number) {
    const workspace = await this.workspaceRepo.findOne({
      where: { workspace_id: id },
      relations: ['files', 'user'],
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const files = workspace.files ?? [];
    const totalSize = files.reduce((s, f) => s + Number(f.size), 0);
    await this.deleteFilesFromStorage(files);
    await this.workspaceRepo.delete(id);

    if (workspace.user && totalSize > 0) {
      const owner = await this.userRepo.findOne({
        where: { user_id: workspace.user.user_id },
      });
      if (owner) {
        await this.userRepo.update(owner.user_id, {
          usedStorage: Math.max(0, Number(owner.usedStorage) - totalSize),
        });
      }
    }

    try {
      if (workspace.user) {
        const uid = workspace.user.user_id;
        await this.cacheManager.del(`cache_user_${uid}_url_/v1/workspaces`);
        await this.cacheManager.del(
          `cache_user_${uid}_url_/v1/files/workspaces/${id}/files`,
        );
      }
    } catch {}

    return { message: 'Workspace deleted' };
  }

  async findFilesByWorkspace(workspaceId: number) {
    const workspace = await this.workspaceRepo.findOne({
      where: { workspace_id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const files = await this.fileRepo.find({
      where: { workspace: { workspace_id: workspaceId } },
    });
    return Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await this.minioClient.presignedUrl(
          'GET',
          this.bucketName,
          f.minio_path,
          3600,
        ),
      })),
    );
  }

  async findFilesWithoutTags() {
    return this.fileRepo
      .createQueryBuilder('f')
      .where('f.tags IS NULL OR f.tags = :empty::jsonb', { empty: '[]' })
      .getMany();
  }

  async findFilesByTag(tag: string) {
    return this.fileRepo
      .createQueryBuilder('f')
      .where('f.tags @> :tag::jsonb', { tag: JSON.stringify([tag]) })
      .getMany();
  }

  async forceDeleteFile(id: number) {
    const file = await this.fileRepo.findOne({
      where: { file_id: id },
      relations: ['workspace', 'workspace.user'],
    });
    if (!file) throw new NotFoundException('File not found');
    const fileSize = Number(file.size);
    const ownerId = file.workspace?.user?.user_id;
    const workspaceId = file.workspace?.workspace_id;

    await this.deleteFilesFromStorage([file]);

    if (ownerId) {
      const owner = await this.userRepo.findOne({
        where: { user_id: ownerId },
      });
      if (owner) {
        await this.userRepo.update(ownerId, {
          usedStorage: Math.max(0, Number(owner.usedStorage) - fileSize),
        });
      }
      try {
        await this.cacheManager.del(`cache_user_${ownerId}_file_url_${id}`);
        if (workspaceId) {
          await this.cacheManager.del(
            `cache_user_${ownerId}_url_/v1/files/workspaces/${workspaceId}/files`,
          );
        }
      } catch {}
    }

    return { message: 'File deleted' };
  }

  async getUserChats(userId: number) {
    return this.chatRepo.find({
      where: { user: { user_id: userId } },
      order: { created_at: 'DESC' },
    });
  }
}
