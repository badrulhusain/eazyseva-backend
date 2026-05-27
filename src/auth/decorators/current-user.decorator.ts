import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUser as CurrentUserType } from '../../common/types/current-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserType => {
    return ctx.switchToHttp().getRequest().user;
  },
);
