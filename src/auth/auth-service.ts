import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user-entity';

import { RegisterRequestDto } from './dto/registerDto/registerRequestDto';
import { RegisterResponseDto } from './dto/registerDto/registerResponseDto';
import { LoginRequestDto } from './dto/loginDto/loginRequestDto';
import { LoginResponseDto } from './dto/loginDto/loginResponseDto';

import { hashPassword } from '../utils/hash-password';
import { comparePassword } from '../utils/compare-password';
import { generateJwtToken } from '../utils/generate-jwt-token';

import { validateRegister, validateLogin } from './auth-validations/auth-validations';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async register(
    dto: RegisterRequestDto,
  ): Promise<RegisterResponseDto> {
    const { name, email, password } = dto;

    await validateRegister(this.userRepository, email, password);

    const hashedPassword = await hashPassword(password);

    const newUser = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    await this.userRepository.save(newUser);

    const token = generateJwtToken({
      user_id: newUser.user_id,
      email: newUser.email,
      username: newUser.name,
    });

    return {
      token,
      message: 'User registered successfully',
    };
  }

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const { name, password } = dto;

    validateLogin(name , password);

    const user = await this.userRepository.findOne({
      where: { name },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = generateJwtToken({
      user_id: user.user_id,
      email: user.email,
      username: user.name,
    });

    return {
      token,
      message: 'Login successful',
    };
  }
}
