import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { LocationService } from './location.service';

@Controller()
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @MessagePattern({ cmd: 'get_locations' })
  findLocations() {
    return this.locationService.findLocations();
  }

  @MessagePattern({ cmd: 'get_location' })
  findLocation(data: { id: number }) {
    return this.locationService.findLocation(data.id);
  }

  @MessagePattern({ cmd: 'create_location' })
  createLocation(data: {
    name?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  }) {
    return this.locationService.createLocation(data);
  }

  @MessagePattern({ cmd: 'update_location' })
  updateLocation(data: { id: number } & Record<string, unknown>) {
    const { id, ...rest } = data;
    return this.locationService.updateLocation(id, rest);
  }

  @MessagePattern({ cmd: 'delete_location' })
  deleteLocation(data: { id: number }) {
    return this.locationService.deleteLocation(data.id);
  }
}
