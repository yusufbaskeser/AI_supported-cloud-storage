import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin-controller';
import { AdminService } from './admin-service';
import { User } from '../entities/user-entity';
import { File } from '../entities/file-entity';
import { Workspace } from '../entities/workspace-entity';
import { Chat } from '../entities/chat-entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, File, Workspace, Chat])],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
