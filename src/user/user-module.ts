import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../entities/user-entity';
import { File } from '../entities/file-entity';
import { UserController } from './user-controller';
import { UserService } from './user-service';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, File])],
  controllers: [UserController],
  providers: [UserService, JwtAuthGuard],
  exports: [UserService],
})
export class UserModule {}
