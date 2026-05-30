import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth-service';
import { RegisterRequestDto } from './dto/registerDto/registerRequestDto';
import { LoginRequestDto } from './dto/loginDto/loginRequestDto';
import { RegisterResponseDto } from './dto/registerDto/registerResponseDto';
import { LoginResponseDto } from './dto/loginDto/loginResponseDto';
import { VerifyEmailDto } from './dto/emailDto/verifyEmailDto';
import { ForgotPasswordRequestDto } from './dto/forgotPasswordDto/forgotPasswordRequestDto';
import { ResetPasswordRequestDto } from './dto/resetPasswordDto/resetPasswordRequestDto';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterRequestDto): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('verify')
  verify(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('login')
  login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordRequestDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
