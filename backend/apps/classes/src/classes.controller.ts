import { Controller, Get } from '@nestjs/common';
import { ClassesService } from './classes.service';

@Controller()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  getHello(): string {
    return this.classesService.getHello();
  }
}
