import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from '../entities/file-entity';
import { Workspace } from '../entities/workspace-entity';
import * as Minio from 'minio';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { FileResponseDto } from './dto/file-response-dto';
import { DeleteFileResponseDto } from './dto/delete-file-response-dto';
import {
  validateWorkspaceExists,
  validateWorkspaceOwnership,
  validateFileExists,
  validateFileOwnership,
} from './file-validations/file-validations';
import { AITagGenerator } from 'src/utils/ai-tag-generator';

@Injectable()
export class FileService {
  private minioClient: Minio.Client;
  private bucketName: string;
  private aiModel: ChatGoogleGenerativeAI;

  constructor(
    @InjectRepository(File)
    private fileRepo: Repository<File>,
    @InjectRepository(Workspace)
    private workspaceRepo: Repository<Workspace>,
  ) {
    this.minioClient = new Minio.Client({
       
        endPoint: process.env.MINIO_ENDPOINT!,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      useSSL: true,
      region: process.env.MINIO_REGION,
    });
    this.bucketName = process.env.MINIO_BUCKET!;

    this.aiModel = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      apiKey: process.env.GEMINI_API_KEY,
    });
  }




  async uploadFiles(
    files: Express.Multer.File[],
    workspace_id: number,
    user_id: number,
  ): Promise<FileResponseDto[]> {
    const workspace = await this.workspaceRepo.findOne({
      where: { workspace_id },
      relations: ['user'],
    });

    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);

    const uploadedFiles: FileResponseDto[] = [];

    for (const file of files) {
      const tags = await AITagGenerator.generateTags(file);
      const minioPath = `${user_id}/${workspace_id}/${Date.now()}-${file.originalname}`;

      await this.minioClient.putObject(
        this.bucketName,
        minioPath,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype },
      );

      const fileRecord = this.fileRepo.create({
        workspace: workspace!,
        filename: file.originalname,
        minio_path: minioPath,
        mime_type: file.mimetype,
        size: file.size,
        tags,
      });

      const saved = await this.fileRepo.save(fileRecord);
      uploadedFiles.push(saved );
    }

    return uploadedFiles;
  }




  async findFilesByWorkspace(workspace_id: number, user_id: number): Promise<FileResponseDto[]> {
    const workspace = await this.workspaceRepo.findOne({
      where: { workspace_id },
      relations: ['user'],
    });

    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);

    return this.fileRepo.find({
      where: { workspace: { workspace_id } },
      order: { uploaded_at: 'DESC' },
    });
  }




  async downloadFile(file_id: number, user_id: number) {
    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    const stream = await this.minioClient.getObject(this.bucketName, file!.minio_path);

    return {
      stream,
      filename: file!.filename,
      mimeType: file!.mime_type,
    };
  }





  async updateFilename(file_id: number, filename: string, user_id: number): Promise<FileResponseDto> {
    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    file!.filename = filename;

    return await this.fileRepo.save(file!);
  }





  async deleteFile(file_id: number, user_id: number): Promise<DeleteFileResponseDto> {
    const file = await this.fileRepo.findOne({
      where: { file_id },
      relations: ['workspace', 'workspace.user'],
    });

    validateFileExists(file);
    validateFileOwnership(file!, user_id);

    await this.minioClient.removeObject(this.bucketName, file!.minio_path);
    await this.fileRepo.remove(file!);

    return { message: 'File deleted successfully' };
  }

  async bulkDelete(file_ids: number[], user_id: number): Promise<DeleteFileResponseDto> {
    let deletedCount = 0;

    for (const file_id of file_ids) {
      const file = await this.fileRepo.findOne({
        where: { file_id },
        relations: ['workspace', 'workspace.user'],
      });

      validateFileExists(file);
      validateFileOwnership(file!, user_id);

      await this.minioClient.removeObject(this.bucketName, file!.minio_path);
      await this.fileRepo.remove(file!);

      deletedCount++;
    }

    return { message: `${deletedCount} files deleted successfully` };
  }





  async deleteAllByWorkspace(workspace_id: number) {
    const files = await this.fileRepo.find({
      where: { workspace: { workspace_id } },
    });

    for (const file of files) {
      await this.minioClient.removeObject(this.bucketName, file.minio_path);
      await this.fileRepo.remove(file);
    }
  }







  async searchByTags(tags: string[], user_id: number): Promise<FileResponseDto[]> {
    return this.fileRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.workspace', 'workspace')
      .where('workspace.user_id = :user_id', { user_id })
      .andWhere('file.tags @> :tags', { tags: JSON.stringify(tags) })
      .getMany();
  }








  
}