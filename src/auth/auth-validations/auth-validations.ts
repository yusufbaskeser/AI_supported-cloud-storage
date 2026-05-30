import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/user-entity';

export async function validateRegister(
  userRepository: Repository<User>,
  email: string,
) {
  if (!email.includes('@') || !email.includes('.')) {
    throw new BadRequestException('Invalid email format');
  }

  const existingUser = await userRepository.findOne({ where: { email } });
  if (existingUser) throw new BadRequestException('Email already exists');
}

export function validateLogin(name: string, password: string) {
  if (!name || !password) {
    throw new BadRequestException('Name and password required');
  }
}
