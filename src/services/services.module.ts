import { Module } from '@nestjs/common';
import { ServicesController, AdminServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
