import { NotFoundException } from '@nestjs/common';
import { User } from '../../entities/user-entity';

export function validateUserExists(user: User | null): void {
  if (!user) throw new NotFoundException('User not found');
}
