import { Injectable, NotFoundException } from '@nestjs/common';
import { servicesSeed } from './services.seed';
import type { ServiceCategory, ServiceItem } from './services.types';

@Injectable()
export class ServicesService {
  findAll(category?: ServiceCategory): ServiceItem[] {
    return servicesSeed
      .filter((service) => service.isActive)
      .filter((service) => !category || service.category === category)
      .sort((a, b) => {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  findBySlug(slug: string): ServiceItem {
    const service = servicesSeed.find(
      (item) => item.slug === slug && item.isActive,
    );

    if (!service) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found',
      });
    }

    return service;
  }
}
