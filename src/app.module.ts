import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { WorkSpaceModule } from './workspace/workspace-module';
import { UserModule } from './user/user-module';
import { AuthModule } from './auth/auth-module';
import { User } from './entities/user-entity';
import { Workspace } from './entities/workspace-entity';
import { File } from './entities/file-entity';
import { Chat } from './entities/chat-entity';
import { FileModule } from './file/file-module';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AdminModule } from './admin/admin-module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ChatModule } from './chat/chat-module';

@Module({
  controllers: [AppController],
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'frontend'),
      serveStaticOptions: {
        index: false,
        cacheControl: false,
        extensions: ['html', 'css', 'js'],
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        },
      },
    }),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        username: configService.get<string>('REDIS_USERNAME'),
        password: configService.get<string>('REDIS_PASSWORD'),
        ttl: 600,
      }),
      inject: [ConfigService]
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Workspace, File, Chat],
      synchronize: process.env.NODE_ENV !== 'production',
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    }),
    FileModule,
    WorkSpaceModule,
    UserModule,
    AdminModule,
    AuthModule,
    ChatModule,
  ],
})
export class AppModule {}