import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { Workspace } from '../entities/workspace-entity';
import { CreateWorkspaceDto } from './dto/create-request-workspace-dto';
import { UpdateWorkspaceDto } from './dto/update-request-workspace-dto';
import { WorkspaceResponseDto } from './dto/workspace-response-dto';
import { DeleteWorkspaceResponseDto } from './dto/delete-workspace-response-dto';
import { WorkspaceValidations } from './workspace-validations/workspace-validations';
import { FileService } from '../file/file-service';

const { validateWorkspaceExists, validateWorkspaceOwnership } = WorkspaceValidations;

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace) private workspaceRepository: Repository<Workspace>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private fileService: FileService,
  ) {}

  async findAllWorkspacesByUser(user_id: number): Promise<WorkspaceResponseDto[]> {
    const rows = await this.workspaceRepository
      .createQueryBuilder('ws')
      .leftJoin('ws.files', 'f')
      .select(['ws.workspace_id', 'ws.name', 'ws.description', 'ws.created_at'])
      .addSelect('COUNT(f.file_id)', 'file_count')
      .where('ws.user = :user_id', { user_id })
      .groupBy('ws.workspace_id')
      .orderBy('ws.created_at', 'DESC')
      .getRawMany();

    return rows.map(r => ({
      workspace_id: r.ws_workspace_id,
      name: r.ws_name,
      description: r.ws_description,
      created_at: r.ws_created_at,
      file_count: parseInt(r.file_count) || 0,
    }));
  }

  async findWorkspaceById(workspace_id: number, user_id: number): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findOne({
      where: { workspace_id },
      relations: ['user'],
    });
    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);
    return {
      workspace_id: workspace!.workspace_id,
      name: workspace!.name,
      description: workspace!.description,
      created_at: workspace!.created_at,
    };
  }

  async createWorkspace(createDto: CreateWorkspaceDto, user_id: number): Promise<WorkspaceResponseDto> {
    const workspace = this.workspaceRepository.create({ ...createDto, user: { user_id } });
    const saved = await this.workspaceRepository.save(workspace);
    await this.cacheManager.del(`cache_user_${user_id}_url_/v1/workspaces`);
    return saved;
  }

  async updateWorkspace(workspace_id: number, updateDto: UpdateWorkspaceDto, user_id: number): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findOne({ where: { workspace_id }, relations: ['user'] });
    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);
    Object.assign(workspace!, updateDto);
    const updated = await this.workspaceRepository.save(workspace!);
    await this.cacheManager.del(`cache_user_${user_id}_url_/v1/workspaces`);
    return updated;
  }

  async deleteWorkspace(workspace_id: number, user_id: number): Promise<DeleteWorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findOne({ where: { workspace_id }, relations: ['user'] });
    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);
    await this.fileService.deleteAllByWorkspace(workspace_id, user_id);
    await this.workspaceRepository.delete({ workspace_id });
    await this.cacheManager.del(`cache_user_${user_id}_url_/v1/workspaces`);
    return { message: 'Workspace successfully deleted' };
  }
}
