import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, LessThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

import { User } from '../entities/user-entity';
import { File } from '../entities/file-entity';
import { RegisterRequestDto } from './dto/registerDto/registerRequestDto';
import { LoginRequestDto } from './dto/loginDto/loginRequestDto';
import { LoginResponseDto } from './dto/loginDto/loginResponseDto';
import { VerifyEmailDto } from './dto/emailDto/verifyEmailDto';
import { hashPassword } from '../utils/hash-password';
import { comparePassword } from '../utils/compare-password';
import { generateJwtToken } from '../utils/generate-jwt-token';
import { validateRegister, validateLogin } from './auth-validations/auth-validations';
import { sendResetPasswordLink, sendVerificationCode } from '../utils/send-mail';
import type { Client as MinioClient } from 'minio';
import { createMinioClient } from '../utils/minio-client';

@Injectable()
export class AuthService {
  private readonly minioClient: MinioClient;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
  ) {
    this.minioClient = createMinioClient();
    this.bucketName = process.env.MINIO_BUCKET!;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredUsersCleanup() {
    const expiredUsers = await this.userRepository.find({
      where: { is_verified: false, verification_code_expires: LessThan(new Date()) },
      select: ['user_id'],
    });

    if (expiredUsers.length === 0) return;

    const userIds = expiredUsers.map(u => u.user_id);

    const files = await this.fileRepository
      .createQueryBuilder('f')
      .innerJoin('f.workspace', 'w')
      .innerJoin('w.user', 'u')
      .where('u.user_id IN (:...userIds)', { userIds })
      .getMany();

    if (files.length > 0) {
      await this.minioClient.removeObjects(this.bucketName, files.map(f => f.minio_path)).catch(() => {});
    }

    await this.userRepository.delete(userIds);
  }

  async register(dto: RegisterRequestDto): Promise<{ message: string }> {
    const { name, password } = dto;
    const email = dto.email.trim().toLowerCase();

    await validateRegister(this.userRepository, email);

    const hashedPassword = await hashPassword(password);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    const newUser = this.userRepository.create({
      name,
      email,
      password: hashedPassword,
      is_verified: false,
      verification_code: otpCode,
      verification_code_expires: expires,
      profile_photo: dto.profile_photo ?? null,
    });

    await this.userRepository.save(newUser);
    await sendVerificationCode(newUser.email, otpCode);

    return { message: 'Register successful! Please check your email for the verification code.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || user.verification_code !== dto.code) {
      throw new UnauthorizedException('Invalid code or user not found!');
    }

    if (!user.verification_code_expires || new Date() > user.verification_code_expires) {
      throw new UnauthorizedException('Code has expired, please request a new one!');
    }

    user.is_verified = true;
    user.verification_code = null;
    user.verification_code_expires = null;
    await this.userRepository.save(user);

    return { message: 'Account verified successfully!' };
  }

  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const { name, password } = dto;
    validateLogin(name, password);

    const user = await this.userRepository.findOne({ where: { name } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    if (!user.is_verified) {
      throw new UnauthorizedException('Account not verified. Please check your email for the verification code.');
    }

    const token = generateJwtToken({
      user_id: user.user_id,
      email: user.email,
      username: user.name,
      role: user.role,
    });

    return { token, message: 'Login successful' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (!user) throw new NotFoundException('No user found with that email.');

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepository.save(user);

    const base = process.env.APP_URL ?? 'http://localhost:3000';
    const resetLink = `${base}/reset-password.html?token=${resetToken}`;
    await sendResetPasswordLink(normalizedEmail, resetLink);

    return { message: 'Password reset link sent to your email.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: token, resetPasswordExpires: MoreThan(new Date()) },
    });

    if (!user) throw new BadRequestException('Expired or invalid token.');

    user.password = await hashPassword(newPassword);
    user.resetPasswordToken = null!;
    user.resetPasswordExpires = null!;
    await this.userRepository.save(user);

    return { message: 'Password updated successfully.' };
  }
}
