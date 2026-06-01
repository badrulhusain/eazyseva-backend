import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { CloudinaryProvider } from './cloudinary.provider';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, CloudinaryProvider],
  // Export UploadsService so other modules (e.g. a future AdminModule) can
  // reuse uploadDocument / deleteDocument without re-declaring the provider.
  exports: [UploadsService],
})
export class UploadsModule {}
