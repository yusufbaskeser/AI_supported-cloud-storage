import { Module } from '@nestjs/common';
import { AuthService } from './auth-service';
import { AuthController } from './auth-controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user-entity';
import { File } from '../entities/file-entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, File])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
