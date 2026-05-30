import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/user-entity';

export async function validateUserExists(
  userRepository: Repository<User>,
  user_id: number,
): Promise<User> {
  const user = await userRepository.findOne({ where: { user_id } });
  if (!user) throw new NotFoundException('User not found');
  return user;
}
