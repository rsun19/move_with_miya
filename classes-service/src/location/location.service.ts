import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  findLocations() {
    return this.prisma.client.location.findMany();
  }

  async findLocation(id: number) {
    const location = await this.prisma.client.location.findUnique({
      where: { id },
    });
    if (!location) throw new NotFoundException(`Location ${id} not found`);
    return location;
  }

  createLocation(data: {
    name?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  }) {
    return this.prisma.client.location.create({ data });
  }

  updateLocation(id: number, data: Record<string, unknown>) {
    return this.prisma.client.location.update({ where: { id }, data });
  }

  deleteLocation(id: number) {
    return this.prisma.client.location.delete({ where: { id } });
  }
}
