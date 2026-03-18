import { Module } from '@nestjs/common';
import { FileService } from './file-service';
import { FileController } from './file-controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user-entity';
import { File } from 'src/entities/file-entity';
import { Workspace } from 'src/entities/workspace-entity';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';

@Module({
  imports: [TypeOrmModule.forFeature([ User, File, Workspace])],
  controllers: [FileController],
  providers: [FileService, JwtAuthGuard],

  exports: [FileService],
})
export class FileModule {}