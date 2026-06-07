import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConsentService } from './consent.service';
import { AcceptConsentDto } from './dto/accept-consent.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

function extractIpAddress(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? null;
}

@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Body() dto: AcceptConsentDto,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    const ipAddress = extractIpAddress(req);
    const userAgent = req.headers['user-agent'] ?? null;

    const data = await this.consentService.accept(
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
    return { success: true, data };
  }

  @Get('status')
  async status(@CurrentUser() user: CurrentUserType) {
    const data = await this.consentService.getStatus(user.id);
    return { success: true, data };
  }
}
