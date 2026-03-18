import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class UpdateFilenameRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  filename: string;
}
