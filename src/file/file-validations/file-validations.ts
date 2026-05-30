import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Workspace } from '../../entities/workspace-entity';
import { File } from '../../entities/file-entity';

export function validateWorkspaceExists(workspace: Workspace | null): void {
  if (!workspace) {
    throw new NotFoundException('Workspace not found');
  }
}

export function validateWorkspaceOwnership(
  workspace: Workspace,
  user_id: number,
): void {
  if (workspace.user.user_id !== user_id) {
    throw new ForbiddenException(
      'You do not have permission to access this workspace',
    );
  }
}

export function validateFileExists(file: File | null): void {
  if (!file) {
    throw new NotFoundException('File not found');
  }
}

export function validateFileOwnership(file: File, user_id: number): void {
  if (file.workspace.user.user_id !== user_id) {
    throw new ForbiddenException(
      'You do not have permission to access this file',
    );
  }
}
