import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY = 'CLOUDINARY';

// Configures the Cloudinary v2 singleton once at startup using values from
// environment variables via ConfigService, then returns the singleton so it
// can be injected into UploadsService via the CLOUDINARY token.
export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY,
  useFactory: (config: ConfigService) => {
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    return cloudinary;
  },
  inject: [ConfigService],
};
