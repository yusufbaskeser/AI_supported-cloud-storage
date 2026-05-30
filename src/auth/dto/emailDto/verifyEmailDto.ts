import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Please enter a valid email address!' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 characters long!' })
  code: string;
}
