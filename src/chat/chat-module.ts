import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat-controller';
import { ChatService } from './chat-service';
import { Chat } from '../entities/chat-entity';
import { User } from '../entities/user-entity';
import { Workspace } from '../entities/workspace-entity';
import { File } from '../entities/file-entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, User, File, Workspace])],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
