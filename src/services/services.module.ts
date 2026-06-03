import { Module } from '@nestjs/common';
import { ServicesController, AdminServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
