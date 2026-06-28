import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

describe('RegistrationController', () => {
  let registrationController: RegistrationController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationController],
      providers: [RegistrationService],
    }).compile();

    registrationController = app.get<RegistrationController>(RegistrationController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(registrationController.getHello()).toBe('Hello World!');
    });
  });
});
