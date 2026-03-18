import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/user-entity';

export async function validateUserExists(
  userRepository: Repository<User>,
  user_id: number,
): Promise<User> {
  const user = await userRepository.findOne({
    where: { user_id },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  return user;
}

export async function validateEmailUnique(
  userRepository: Repository<User>,
  email: string,
  currentUserId?: number,
) {
  const existingUser = await userRepository.findOne({
    where: { email },
  });

  if (existingUser && existingUser.user_id !== currentUserId) {
    throw new BadRequestException('Email already exists');
  }
}
