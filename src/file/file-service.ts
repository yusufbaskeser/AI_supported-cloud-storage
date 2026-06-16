import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { File } from '../entities/file-entity';
import { Workspace } from '../entities/workspace-entity';
import { User } from '../entities/user-entity';
import type { Client as MinioClient } from 'minio';
import { FileResponseDto } from './dto/file-response-dto';
import { DeleteFileResponseDto } from './dto/delete-file-response-dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  validateWorkspaceExists,
  validateWorkspaceOwnership,
  validateFileExists,
  validateFileOwnership,
} from './file-validations/file-validations';
import { AITagGenerator } from '../utils/ai-tag-generator';
import { createMinioClient } from '../utils/minio-client';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Injectable()
export class FileService {
  private minioClient: MinioClient;
  private bucketName: string;

  constructor(
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectRepository(Workspace) private workspaceRepo: Repository<Workspace>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.minioClient = createMinioClient();
    this.bucketName = process.env.MINIO_BUCKET!;
    AITagGenerator.initialize(process.env.GEMINI_API_KEY!);
  }

  private async delCache(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch {}
  }

  private async getCache<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cacheManager.get<T>(key)) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private async setCache(
    key: string,
    value: unknown,
    ttl: number,
  ): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch {}
  }

  private validateFile(file: Express.Multer.File): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File "${file.originalname}" exceeds the 50MB size limit`,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed`,
      );
    }
  }

  private async checkContentSafety(
    file: Express.Multer.File,
  ): Promise<boolean> {
    try {
      if (!file.mimetype.startsWith('image/')) return true;

      const response = await AITagGenerator.getModel().invoke([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "Does this image contain inappropriate content (violence, nudity, illegal items)? Reply only 'true' for inappropriate or 'false' for safe.",
            },
            {
              type: 'image_url',
              image_url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
            },
          ],
        },
      ]);

      return !response.content.toString().toLowerCase().includes('true');
    } catch {
      return true;
    }
  }

  async uploadFiles(
    files: Express.Multer.File[],
    workspace_id: number,
    user_id: number,
  ): Promise<FileResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    const workspace = await this.workspaceRepo.findOne({
      where: { workspace_id },
      relations: ['user'],
    });

    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);

    files.forEach((file) => this.validateFile(file));

    const user = await this.userRepo.findOne({ where: { user_id } });
    if (user) {
      const totalNewSize = files.reduce((sum, f) => sum + f.size, 0);
      const currentUsage = Number(user.usedStorage);
      const limit = Number(user.storageLimit);
      if (currentUsage + totalNewSize > limit) {
        const remainingMB = ((limit - currentUsage) / (1024 * 1024)).toFixed(1);
        throw new BadRequestException(
          `Storage limit exceeded. You have ${remainingMB} MB remaining out of your 5 GB quota.`,
        );
      }
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const isSafe = await this.checkContentSafety(file);
        if (!isSafe) return null;

        const safeFileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        const minioPath = `${user_id}/${workspace_id}/${safeFileName}`;

        await this.minioClient.putObject(
          this.bucketName,
          minioPath,
          file.buffer,
          file.buffer.length,
          { 'Content-Type': file.mimetype },
        );

        try {
          const fileRecord = this.fileRepo.create({
            workspace: workspace!,
            filename: file.originalname,
            minio_path: minioPath,
            mime_type: file.mimetype,
            size: file.size,
            tags: [],
          });
          const saved = await this.fileRepo.save(fileRecord);
          this.generateAndSaveTags(saved.file_id, file).catch(console.error);
          return saved;
        } catch (err) {
          await this.minioClient
            .removeObject(this.bucketName, minioPath)
            .catch(() => {});
          throw err;
        }
      }),
    );
    const successfulFiles = uploadedFiles.filter((f) => f !== null);
    if (successfulFiles.length > 0) {
      const uploadedSize = successfulFiles.reduce(
        (sum, f) => sum + Number(f.size),
        0,
      );
      await this.userRepo.increment({ user_id }, 'usedStorage', uploadedSize);
    }
    await Promise.all([
      this.delCache(
        `cache_user_${user_id}_url_/v1/files/workspaces/${workspace_id}/files`,
      ),
      this.delCache(`cache_user_${user_id}_url_/v1/workspaces`),
    ]);
    return successfulFiles as FileResponseDto[];
  }

  private async generateAndSaveTags(fileId: number, file: Express.Multer.File) {
    try {
      const tags = await AITagGenerator.generateTags(file);
      await this.fileRepo.update(fileId, { tags });
    } catch (error) {
      console.error('Background tag generation error:', error);
    }
  }

  async findFilesByWorkspace(
    workspace_id: number,
    user_id: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: FileResponseDto[]; total: number; hasMore: boolean }> {
    const workspace = await this.workspaceRepo.findOne({
      where: { workspace_id },
      relations: ['user'],
    });
    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);

    const [data, total] = await this.fileRepo.findAndCount({
      where: { workspace: { workspace_id } },
      order: { uploaded_at: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total, hasMore: page * limit < total };
  }

  async getFileUrl(file_id: number, user_id: number): Promise<string> {
    const cacheKey = `cache_user_${user_id}_file_url_${file_id}`;
    const cached = await this.getCache<string>(cacheKey);
    if (cached) return cached;

    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    const url = await this.minioClient.presignedUrl(
      'GET',
      this.bucketName,
      file!.minio_path,
      3600,
    );
    await this.setCache(cacheKey, url, 90 * 1000);

    return url;
  }

  async getFileDownloadUrl(file_id: number, user_id: number): Promise<string> {
    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    const encoded = encodeURIComponent(file!.filename);
    const disposition = `attachment; filename="${file!.filename}"; filename*=UTF-8''${encoded}`;
    const url = await this.minioClient.presignedUrl(
      'GET',
      this.bucketName,
      file!.minio_path,
      3600,
      { 'response-content-disposition': disposition },
    );

    return url;
  }

  async generateShareUrl(
    file_id: number,
    user_id: number,
    expirySeconds: number,
  ): Promise<{ url: string; expires_at: string }> {
    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    const clamped = Math.min(
      Math.max(Number(expirySeconds) || 3600, 300),
      7 * 24 * 3600,
    );
    const url = await this.minioClient.presignedUrl(
      'GET',
      this.bucketName,
      file!.minio_path,
      clamped,
    );
    const expiresAt = new Date(Date.now() + clamped * 1000).toISOString();

    return { url, expires_at: expiresAt };
  }

  async updateFilename(
    file_id: number,
    filename: string,
    user_id: number,
  ): Promise<FileResponseDto> {
    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    file!.filename = filename;
    const updatedFile = await this.fileRepo.save(file!);

    await this.delCache(
      `cache_user_${user_id}_url_/v1/files/workspaces/${file!.workspace.workspace_id}/files`,
    );
    await this.delCache(`cache_user_${user_id}_file_url_${file_id}`);

    return updatedFile;
  }

  async bulkDelete(
    file_ids: number[],
    user_id: number,
  ): Promise<DeleteFileResponseDto> {
    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return { message: 'No file IDs provided' };
    }

    const files = await this.fileRepo.find({
      where: { file_id: In(file_ids) },
      relations: ['workspace', 'workspace.user'],
    });

    if (files.length === 0) {
      return { message: 'No files found in database' };
    }

    files.forEach((f) => validateFileOwnership(f, user_id));

    const affectedWorkspaceIds = [
      ...new Set(files.map((f) => f.workspace.workspace_id)),
    ];
    const pathsToDelete = files.map((f) => f.minio_path);
    const totalDeletedSize = files.reduce((sum, f) => sum + Number(f.size), 0);

    try {
      await this.minioClient.removeObjects(this.bucketName, pathsToDelete);
      await this.fileRepo.remove(files);

      const ownerUser = await this.userRepo.findOne({ where: { user_id } });
      if (ownerUser) {
        await this.userRepo.update(user_id, {
          usedStorage: Math.max(
            0,
            Number(ownerUser.usedStorage) - totalDeletedSize,
          ),
        });
      }

      await Promise.all([
        ...affectedWorkspaceIds.map((wsId) =>
          this.delCache(
            `cache_user_${user_id}_url_/v1/files/workspaces/${wsId}/files`,
          ),
        ),
        this.delCache(`cache_user_${user_id}_url_/v1/workspaces`),
        ...files.map((f) =>
          this.delCache(`cache_user_${user_id}_file_url_${f.file_id}`),
        ),
      ]);

      return {
        message: `${files.length} files deleted successfully from R2 and Database`,
      };
    } catch (error) {
      console.error('Bulk Delete Error:', error);
      throw new InternalServerErrorException('Failed to delete files');
    }
  }

  async loadWorkspaceFiles(workspace_id: number): Promise<File[]> {
    return this.fileRepo.find({ where: { workspace: { workspace_id } } });
  }

  async runMinioCleanup(
    files: File[],
    user_id: number,
    workspace_id: number,
  ): Promise<void> {
    if (files.length === 0) return;

    const paths = files.map((f) => f.minio_path);
    const totalSize = files.reduce((sum, f) => sum + Number(f.size), 0);

    await this.minioClient.removeObjects(this.bucketName, paths);

    const ownerUser = await this.userRepo.findOne({ where: { user_id } });
    if (ownerUser) {
      await this.userRepo.update(user_id, {
        usedStorage: Math.max(0, Number(ownerUser.usedStorage) - totalSize),
      });
    }

    await Promise.all([
      ...files.map((f) =>
        this.delCache(`cache_user_${user_id}_file_url_${f.file_id}`),
      ),
      this.delCache(
        `cache_user_${user_id}_url_/v1/files/workspaces/${workspace_id}/files`,
      ),
    ]);
  }
}
