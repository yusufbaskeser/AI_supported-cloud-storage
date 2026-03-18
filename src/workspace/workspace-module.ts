
import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace-service';
import { WorkspaceController } from './workspace-controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user-entity';
import { Workspace } from 'src/entities/workspace-entity';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';

@Module({
  imports: [TypeOrmModule.forFeature([ User, Workspace])],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, JwtAuthGuard],

  exports: [WorkspaceService],
})
export class WorkSpaceModule {}