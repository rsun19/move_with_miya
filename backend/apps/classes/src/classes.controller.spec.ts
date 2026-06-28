import { Test, TestingModule } from '@nestjs/testing';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

describe('ClassesController', () => {
  let classesController: ClassesController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [ClassesService],
    }).compile();

    classesController = app.get<ClassesController>(ClassesController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(classesController.getHello()).toBe('Hello World!');
    });
  });
});
