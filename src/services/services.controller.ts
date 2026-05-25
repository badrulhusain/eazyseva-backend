import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ServicesService } from './services.service';
import type { ServiceCategory } from './services.types';

@Public()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@Query('category') category?: ServiceCategory) {
    return {
      success: true,
      data: this.servicesService.findAll(category),
    };
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return {
      success: true,
      data: this.servicesService.findBySlug(slug),
    };
  }
}
