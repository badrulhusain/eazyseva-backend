import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import type { ServiceCategory } from './services.types';

@Public()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll(@Query('category') category?: ServiceCategory) {
    const data = await this.servicesService.findAll(category);
    return { success: true, data };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.servicesService.findBySlug(slug);
    return { success: true, data };
  }
}

@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin/services')
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  async create(@Body() dto: CreateServiceDto) {
    const data = await this.servicesService.create(dto);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    const data = await this.servicesService.update(id, dto);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.servicesService.softDelete(id);
    return { success: true, data };
  }
}
