import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ClassesService } from './classes.service';

@Controller()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @MessagePattern({ cmd: 'get_classes' })
  findClasses() {
    return this.classesService.findClasses();
  }

  @MessagePattern({ cmd: 'get_classes_in_range' })
  findClassesInRange(data: { from: string; to: string }) {
    return this.classesService.findClassesInRange(data.from, data.to);
  }

  @MessagePattern({ cmd: 'get_class' })
  findClass(data: { id: number }) {
    return this.classesService.findClass(data.id);
  }

  @MessagePattern({ cmd: 'create_class' })
  createClass() {
    return this.classesService.createClass();
  }

  @MessagePattern({ cmd: 'update_class' })
  updateClass(data: { id: number } & Record<string, unknown>) {
    return this.classesService.updateClass(data.id);
  }

  @MessagePattern({ cmd: 'delete_class' })
  deleteClass(data: { id: number }) {
    return this.classesService.deleteClass(data.id);
  }
}
