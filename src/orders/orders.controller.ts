import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

// ── User-facing routes (JWT only) ─────────────────────────────────────────────

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.create(dto, user.id);
    return { success: true, data };
  }

  @Get('my-orders')
  async getMyOrders(@CurrentUser() user: CurrentUserType) {
    const data = await this.ordersService.findMyOrders(user.id);
    return { success: true, data };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.findOne(id, user.id);
    return { success: true, data };
  }
}

// ── Admin routes (JWT + ADMIN role) ──────────────────────────────────────────

@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * GET /api/v1/admin/orders?page=1&limit=20&status=PENDING
   *
   * Paginated list — lightweight columns only.
   * Max 100 rows per page (enforced by PaginationDto @Max(100)).
   * Use GET /admin/orders/:id for full order detail including documents/timeline.
   */
  @Get()
  async findAll(@Query() query: PaginationDto) {
    const result = await this.ordersService.findAll(query);
    return { success: true, ...result };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.ordersService.findOneAdmin(id);
    return { success: true, data };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const data = await this.ordersService.updateStatus(id, dto);
    return { success: true, data };
  }
}
