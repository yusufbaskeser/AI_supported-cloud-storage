import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user-entity';
import { UserResponseDto } from './dto/userResponseDto';
import { UserUpdateRequestDto } from './dto/userUpdateRequestDto';
import { UserUpdateResponseDto } from './dto/userUpdateResponseDto';
import { UserDeleteResponseDto } from './dto/userDeleteResponseDto';

import { validateUserExists } from './user-validations/user-validations';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUsers(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find();

    if (users.length === 0) {
      throw new NotFoundException('No users found');
    }

    return users.map((user) => ({
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    }));
  }

  async getUser(user_id: number): Promise<UserResponseDto> {
    const user = await validateUserExists(this.userRepository, user_id);

    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    };
  }

  async updateUser(
    user_id: number,
    dto: UserUpdateRequestDto,
  ): Promise<UserUpdateResponseDto> {
    const user = await validateUserExists(this.userRepository, user_id);

    if (dto.name) {
      user.name = dto.name;
    }

    if (dto.email) {
      user.email = dto.email;
    }

    await this.userRepository.save(user);

    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      message: 'User updated successfully',
    };
  }

  async deleteUser(user_id: number): Promise<UserDeleteResponseDto> {
    await validateUserExists(this.userRepository, user_id);

    await this.userRepository.delete({ user_id });

    return {
      message: 'User deleted successfully',
    };
  }
}