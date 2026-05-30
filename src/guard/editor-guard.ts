import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../entities/user-entity';

@Injectable()
export class EditorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Authentication required');

    const allowed = [UserRole.SUPER_ADMIN, UserRole.EDITOR_ADMIN];
    if (!allowed.includes(user.role)) throw new ForbiddenException('Editor or Super admin required');

    return true;
  }
}
