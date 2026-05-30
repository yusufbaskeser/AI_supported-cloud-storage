import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as Minio from 'minio';

import { User } from '../entities/user-entity';
import { File } from '../entities/file-entity';
import { UserResponseDto } from './dto/userResponseDto';
import { UserUpdateRequestDto } from './dto/userUpdateRequestDto';
import { UserUpdateResponseDto } from './dto/userUpdateResponseDto';
import { UserDeleteResponseDto } from './dto/userDeleteResponseDto';
import { validateUserExists } from './user-validations/user-validations';
import { hashPassword } from 'src/utils/hash-password';

@Injectable()
export class UserService {
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!.replace('https://', ''),
      port: 443,
      useSSL: true,
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
      region: 'auto',
    });
    this.bucketName = process.env.MINIO_BUCKET!;
  }

  async getUser(user_id: number): Promise<UserResponseDto> {
    const user = await validateUserExists(this.userRepository, user_id);
    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      storageLimit: Number(user.storageLimit),
      usedStorage: Number(user.usedStorage),
      profile_photo: user.profile_photo ?? null,
    };
  }

  async updateUser(user_id: number, dto: UserUpdateRequestDto): Promise<UserUpdateResponseDto> {
    const user = await validateUserExists(this.userRepository, user_id);

    if (dto.name) user.name = dto.name;
    if (dto.password) user.password = await hashPassword(dto.password);
    if (dto.profile_photo !== undefined) user.profile_photo = dto.profile_photo;

    await this.userRepository.save(user);
    await this.cacheManager.del(`cache_user_${user_id}_url_/v1/users/${user_id}`);

    return { message: 'User updated successfully' };
  }

  async deleteUser(user_id: number): Promise<UserDeleteResponseDto> {
    await validateUserExists(this.userRepository, user_id);

    const files = await this.fileRepository
      .createQueryBuilder('f')
      .innerJoin('f.workspace', 'w')
      .innerJoin('w.user', 'u')
      .where('u.user_id = :user_id', { user_id })
      .getMany();

    if (files.length > 0) {
      await this.minioClient.removeObjects(this.bucketName, files.map(f => f.minio_path));
    }

    await this.userRepository.delete({ user_id });
    await this.cacheManager.del(`cache_user_${user_id}_url_/v1/users/${user_id}`);
    return { message: 'User deleted successfully' };
  }
}
