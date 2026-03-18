import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkspaceService } from './workspace-service';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';
import { CreateWorkspaceDto } from './dto/create-request-workspace-dto';
import { UpdateWorkspaceDto } from './dto/update-request-workspace-dto';
import { WorkspaceResponseDto } from './dto/workspace-response-dto';
import { DeleteWorkspaceResponseDto } from './dto/delete-workspace-response-dto';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async getAllWorkspaces(@Request() req): Promise<WorkspaceResponseDto[]> {
    return this.workspaceService.findAllWorkspacesByUser(req.user.user_id);
  }

  @Get(':workspace_id')
  async getWorkspaceById(
    @Param('workspace_id') workspace_id: number,
    @Request() req,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.findWorkspaceById(workspace_id, req.user.user_id);
  }

  @Post()
  async createWorkspace(
    @Body() createDto: CreateWorkspaceDto,
    @Request() req,
  ): Promise<WorkspaceResponseDto> {
    console.log('Gelen body:', createDto);
    return this.workspaceService.createWorkspace(createDto, req.user.user_id);
  }

  @Put(':workspace_id')
  async updateWorkspace(
    @Param('workspace_id') workspace_id: number,
    @Body() updateDto: UpdateWorkspaceDto,
    @Request() req,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.updateWorkspace(workspace_id, updateDto, req.user.user_id);
  }

  @Delete(':workspace_id')
  async deleteWorkspace(
    @Param('workspace_id') workspace_id: number,
    @Request() req,
  ): Promise<DeleteWorkspaceResponseDto> {
    return this.workspaceService.deleteWorkspace(workspace_id, req.user.user_id);
  }
}
