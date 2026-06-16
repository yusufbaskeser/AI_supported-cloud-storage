import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../entities/user-entity';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest() as {
      user?: { role?: UserRole };
    };
    const user = request.user;
    if (!user || !user.role) throw new ForbiddenException('Authentication required');

    const allowed = [
      UserRole.SUPER_ADMIN,
      UserRole.EDITOR_ADMIN,
      UserRole.VIEWER_ADMIN,
    ];
    if (!allowed.includes(user.role))
      throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
