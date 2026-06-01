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
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { StartDemoPaymentDto } from './dto/start-demo-payment.dto';
import { ConfirmDemoPaymentDto } from './dto/confirm-demo-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

@Controller('payments/demo')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** POST /api/v1/payments/demo/start — Initiate a demo payment session */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  startPayment(
    @Body() dto: StartDemoPaymentDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.paymentsService.startPayment(dto, user.id);
  }

  /** POST /api/v1/payments/demo/confirm — Confirm or fail the pending session */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirmPayment(
    @Body() dto: ConfirmDemoPaymentDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.paymentsService.confirmPayment(dto, user.id);
  }

  /**
   * PATCH /api/v1/payments/demo/reset/:orderId
   *
   * Resets a stuck PAYMENT_PENDING session back to NOT_PAID.
   * Use when the user started a payment but closed the browser before confirming.
   * Only callable by the order owner. Cannot reset a PAID order.
   */
  @Patch('reset/:orderId')
  @HttpCode(HttpStatus.OK)
  resetPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.paymentsService.resetPayment(orderId, user.id);
  }

  /** PATCH /api/v1/payments/demo/pay-later/:orderId — Mark as Pay Later */
  @Patch('pay-later/:orderId')
  payLater(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.paymentsService.payLater(orderId, user.id);
  }

  /** GET /api/v1/payments/demo/order/:orderId — Poll payment status */
  @Get('order/:orderId')
  getPaymentStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.paymentsService.getPaymentStatus(orderId, user.id);
  }
}
