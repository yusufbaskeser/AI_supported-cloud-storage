import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ChatService } from './chat-service';
import { SendMessageRequestDto } from './dto/send-message-request-dto';
import { ChatResponseDto } from './dto/chat-response-dto';
import { JwtAuthGuard } from '../guard/jwt-auth-guard';

@Controller({ path: 'chat', version: '1' })
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async sendMessage(
    @Body() messageDto: SendMessageRequestDto,
    @Request() req,
  ): Promise<ChatResponseDto> {
    return this.chatService.handleMessage(messageDto.message, req.user.user_id);
  }
}
