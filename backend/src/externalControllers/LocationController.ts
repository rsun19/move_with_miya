import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('locations')
export class LocationController {
  constructor(
    @Inject('CLASSES_SERVICE') private readonly classesClient: ClientProxy,
  ) {}

  @Get()
  findLocations() {
    return this.classesClient.send({ cmd: 'get_locations' }, {});
  }

  @Get(':id')
  findLocation(@Param('id', ParseIntPipe) id: number) {
    return this.classesClient.send({ cmd: 'get_location' }, { id });
  }

  @Post()
  createLocation(@Body() body: Record<string, unknown>) {
    return this.classesClient.send({ cmd: 'create_location' }, body);
  }

  @Patch(':id')
  updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.classesClient.send({ cmd: 'update_location' }, { ...body, id });
  }

  @Delete(':id')
  deleteLocation(@Param('id', ParseIntPipe) id: number) {
    return this.classesClient.send({ cmd: 'delete_location' }, { id });
  }
}
