import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorkSpaceModule } from './workspace/workspace-module';
import { UserModule } from './user/user-module';
import { AuthModule } from './auth/auth-module';
import { User } from './entities/user-entity';
import { Workspace } from './entities/workspace-entity';
import { File } from './entities/file-entity';
import { Chat } from './entities/chat-entity';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true 
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Workspace, File, Chat],
      synchronize: true,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    WorkSpaceModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}