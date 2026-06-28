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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { RequestCorrectionDto } from './dto/request-correction.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
import { Public } from '../auth/decorators/public.decorator';
import { TrackOrderDto } from './dto/track-order.dto';
import type { Response } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { QueryAuditLogDto } from '../audit-logs/dto/query-audit-log.dto';

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
  async getMyOrders(
    @CurrentUser() user: CurrentUserType,
    @Query() query: PaginationDto,
  ) {
    const result = await this.ordersService.findMyOrders(user.id, query);
    return { success: true, ...result };
  }

  @Public()
  @Post('track')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  async track(@Body() dto: TrackOrderDto) {
    const data = await this.ordersService.trackPublic(
      dto.orderNumber,
      dto.phone,
    );
    return { success: true, data };
  }

  @Get(':id/receipt')
  async receipt(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.ordersService.createReceipt(id, user.id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="ezyseva-receipt-${id}.pdf"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return pdf;
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

@UseGuards(AdminGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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

  @Get('stats')
  async stats() {
    const data = await this.ordersService.getDashboardStats();
    return { success: true, data };
  }

  @Get('activity')
  async activity(@Query() query: QueryAuditLogDto) {
    const result = await this.auditLogsService.findRecent(query);
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
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.updateStatus(id, dto, user.id);
    return { success: true, data };
  }

  @Patch(':id/accept')
  async accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.acceptOrder(id, user.id);
    return { success: true, data };
  }

  @Patch(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.rejectOrder(id, dto, user.id);
    return { success: true, data };
  }

  @Patch(':id/request-correction')
  async requestCorrection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestCorrectionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.requestCorrection(id, dto, user.id);
    return { success: true, data };
  }

  @Patch(':id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    const data = await this.ordersService.completeOrder(id, user.id);
    return { success: true, data };
  }
}
