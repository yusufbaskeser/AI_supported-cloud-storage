import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Workspace } from '../../entities/workspace-entity';


export class WorkspaceValidations {
  static validateWorkspaceExists(workspace: Workspace | null): void {
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
  }

  static validateWorkspaceOwnership(workspace: Workspace, user_id: number): void {
    if (workspace.user.user_id !== user_id) {
      throw new ForbiddenException('You do not have permission to access this workspace');
    }
  }
}