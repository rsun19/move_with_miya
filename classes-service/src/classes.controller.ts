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
  createClass(data: {
    name: string;
    teacherIds: string[];
    capacity: number;
    cost?: string | number;
    description?: string;
    duration?: number;
    imageUrl?: string | null;
    startDate: string;
    endDate: string;
    locationId: number;
    status?: string;
    isPrivate?: boolean;
    waitlistEnabled?: boolean;
    cancellationCutoffHours?: number;
  }) {
    return this.classesService.createClass(data);
  }

  @MessagePattern({ cmd: 'update_class' })
  updateClass(data: { id: number } & Record<string, unknown>) {
    const { id, ...rest } = data;
    return this.classesService.updateClass(id, rest);
  }

  @MessagePattern({ cmd: 'delete_class' })
  deleteClass(data: { id: number }) {
    return this.classesService.deleteClass(data.id);
  }
}
