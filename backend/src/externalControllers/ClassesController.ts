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
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('classes')
export class ClassesController {
  constructor(
    @Inject('CLASSES_SERVICE') private readonly classesClient: ClientProxy,
  ) {}

  @Get()
  findClasses() {
    return this.classesClient.send({ cmd: 'get_classes' }, {});
  }

  @Get('range')
  findClassesInRange(@Query('from') from: string, @Query('to') to: string) {
    return this.classesClient.send(
      { cmd: 'get_classes_in_range' },
      { from, to },
    );
  }

  @Get(':id')
  findClass(@Param('id', ParseIntPipe) id: number) {
    return this.classesClient.send({ cmd: 'get_class' }, { id });
  }

  @Post()
  createClass() {
    return this.classesClient.send({ cmd: 'create_class' }, {});
  }

  @Patch(':id')
  updateClass(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.classesClient.send({ cmd: 'update_class' }, { id, ...body });
  }

  @Delete(':id')
  deleteClass(@Param('id', ParseIntPipe) id: number) {
    return this.classesClient.send({ cmd: 'delete_class' }, { id });
  }
}
