import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CurrentUser } from '../../common/types/current-user.type';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();

    if (!request.user || request.user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'ADMIN_ONLY',
        message: 'Admin access required',
      });
    }

    return true;
  }
}
