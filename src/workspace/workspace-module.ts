import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace-service';
import { WorkspaceController } from './workspace-controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../entities/workspace-entity';
import { File } from '../entities/file-entity';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';
import { FileService } from '../file/file-service';
import { User } from '../entities/user-entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, File, User])],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, FileService, JwtAuthGuard],
  exports: [WorkspaceService],
})
export class WorkSpaceModule {}
