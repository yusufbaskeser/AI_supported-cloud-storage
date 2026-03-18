import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../entities/workspace-entity';
import { User } from '../entities/user-entity';
import { CreateWorkspaceDto } from './dto/create-request-workspace-dto';
import { UpdateWorkspaceDto } from './dto/update-request-workspace-dto';
import { WorkspaceResponseDto } from './dto/workspace-response-dto';
import { DeleteWorkspaceResponseDto } from './dto/delete-workspace-response-dto';
import { WorkspaceValidations } from './workspace-validations/workspace-validations';

const { validateWorkspaceExists, validateWorkspaceOwnership } = WorkspaceValidations;

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}




async findAllWorkspacesByUser(user_id: number): Promise<WorkspaceResponseDto[]> {
  const workspaces = await this.workspaceRepository.find({
    where: { user: { user_id } },
    order: { created_at: 'DESC' },
  });

  return workspaces;
}




 async findWorkspaceById(
  workspace_id: number,
  user_id: number,
): Promise<WorkspaceResponseDto> {
  const workspace = await this.workspaceRepository.findOne({
    where: { workspace_id },
    relations: ['user'],
  });

  validateWorkspaceExists(workspace);
  validateWorkspaceOwnership(workspace!, user_id);

  return workspace!;
}

async createWorkspace(
  createDto: CreateWorkspaceDto,
  user_id: number,
): Promise<WorkspaceResponseDto> {
  const workspace = this.workspaceRepository.create({
    ...createDto,
    user: { user_id },
  });

  return await this.workspaceRepository.save(workspace);
}




async updateWorkspace(
  workspace_id: number,
  updateDto: UpdateWorkspaceDto,
  user_id: number,
): Promise<WorkspaceResponseDto> {
  const workspace = await this.workspaceRepository.findOne({
    where: { workspace_id },
    relations: ['user'],
  });

validateWorkspaceExists(workspace);
validateWorkspaceOwnership(workspace!, user_id);

  Object.assign(workspace!, updateDto);

  return await this.workspaceRepository.save(workspace!);
}




  async deleteWorkspace(
    workspace_id: number,
    user_id: number,
  ): Promise<DeleteWorkspaceResponseDto> {
    const workspace = await this.workspaceRepository.findOne({
      where: { workspace_id },
      relations: ['user'],
    });

    validateWorkspaceExists(workspace);
    validateWorkspaceOwnership(workspace!, user_id);

    await this.workspaceRepository.delete({ workspace_id });

    return {
      message: 'Workspace successfully deleted',
    };
  }

 
  
}
