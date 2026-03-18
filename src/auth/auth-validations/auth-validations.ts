import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/user-entity';

export async function validateRegister(
  userRepository: Repository<User>,
  email: string,
  password: string,
) {
  if (!email || !password) {
    throw new BadRequestException('Email and password required');
  }

  email = email.trim().toLowerCase();
  password = password.trim();

  if (email.length === 0 || password.length === 0) {
    throw new BadRequestException('Email and password cannot be empty');
  }

  if (!email.includes('@') || !email.includes('.')) {
    throw new BadRequestException('Invalid email format');
  }

  const existingUser = await userRepository.findOne({
    where: { email },
  });

  if (existingUser) {
    throw new BadRequestException('Email already exists');
  }



}

export function validateLogin(email: string, password: string) {
  if (!email || !password) {
    throw new BadRequestException('Email and password required');
  }
}
