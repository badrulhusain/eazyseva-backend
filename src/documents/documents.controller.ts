import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrderDocumentsService } from './documents.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

@UseGuards(AdminGuard)
@Controller('admin/documents')
export class AdminDocumentsController {
  constructor(private readonly documentsService: OrderDocumentsService) {}

  @Post('process-deletions')
  @HttpCode(HttpStatus.OK)
  async processDeletions(@CurrentUser() user: CurrentUserType) {
    const data = await this.documentsService.processDueDeletions(user.id);
    return { success: true, data };
  }
}
