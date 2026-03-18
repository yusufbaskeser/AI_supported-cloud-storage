import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth-service';
import { RegisterRequestDto } from './dto/registerDto/registerRequestDto';
import { LoginRequestDto } from './dto/loginDto/loginRequestDto';
import { RegisterResponseDto } from './dto/registerDto/registerResponseDto';
import { LoginResponseDto } from './dto/loginDto/loginResponseDto';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterRequestDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginRequestDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
