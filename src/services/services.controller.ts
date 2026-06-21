import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/query-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Public()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll(@Query() query: ServiceQueryDto) {
    const result = await this.servicesService.findAll(query);
    return { success: true, ...result };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const data = await this.servicesService.findBySlug(slug);
    return { success: true, data };
  }
}

@UseGuards(AdminGuard)
@Controller('admin/services')
export class AdminServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll(@Query() query: ServiceQueryDto) {
    const result = await this.servicesService.findAllAdmin(query);
    return { success: true, ...result };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.servicesService.findById(id);
    return { success: true, data };
  }

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
