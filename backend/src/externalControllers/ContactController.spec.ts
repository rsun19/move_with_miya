import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { ContactController } from './ContactController';
import { ContactEmailService } from './contact-email.service';

jest.mock('../common/guards/admin.guard', () => ({
  AdminGuard: jest.fn().mockImplementation(() => ({ canActivate: () => true })),
}));

describe('ContactController', () => {
  let controller: ContactController;
  let client: { send: jest.Mock };
  let emailService: { notify: jest.Mock };

  beforeEach(async () => {
    client = { send: jest.fn() };
    emailService = { notify: jest.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        { provide: 'REGISTRATION_SERVICE', useValue: client },
        { provide: ContactEmailService, useValue: emailService },
      ],
    }).compile();
    controller = module.get(ContactController);
  });

  it('stores a submission and sends a notification', async () => {
    const dto = {
      name: 'A Person',
      email: 'person@example.com',
      subject: 'Question',
      message: 'Hello studio',
    };
    const saved = { id: 1, ...dto };
    client.send.mockReturnValue(of(saved));

    await expect(controller.create(dto)).resolves.toEqual(saved);
    expect(client.send).toHaveBeenCalledWith(
      { cmd: 'create_contact_submission' },
      dto,
    );
    expect(emailService.notify).toHaveBeenCalledWith(dto);
  });
});
