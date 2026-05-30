import { IsString, IsNotEmpty } from 'class-validator';

export class SendMessageRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}