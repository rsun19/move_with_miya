import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { RegistrationController } from './RegistrationController';

jest.mock('../common/guards/admin.guard', () => ({
  AdminGuard: jest.fn().mockImplementation(() => ({ canActivate: () => true })),
}));
jest.mock('../common/guards/staff.guard', () => ({
  StaffGuard: jest.fn().mockImplementation(() => ({ canActivate: () => true })),
}));

describe('RegistrationController', () => {
  let controller: RegistrationController;
  let client: { send: jest.Mock };
  let classesClient: { send: jest.Mock };

  const sessionUserId = 'user-1';

  const buildRequest = (userId?: string) =>
    ({ session: { userId: userId ?? null } }) as Parameters<
      RegistrationController['createRegistration']
    >[0];

  beforeEach(async () => {
    client = { send: jest.fn() };
    classesClient = { send: jest.fn() };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ banned: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const module = await Test.createTestingModule({
      controllers: [RegistrationController],
      providers: [
        { provide: 'REGISTRATION_SERVICE', useValue: client },
        { provide: 'CLASSES_SERVICE', useValue: classesClient },
      ],
    }).compile();
    controller = module.get(RegistrationController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('rpc error mapping', () => {
    it('maps 409 to ConflictException', async () => {
      client.send.mockReturnValue(
        throwError(() => ({ statusCode: 409, message: 'Already registered' })),
      );
      await expect(
        controller['rpc']('create_registration', { classId: 1, userId: 'u' }),
      ).rejects.toThrow(ConflictException);
    });

    it('maps 404 to NotFoundException', async () => {
      client.send.mockReturnValue(
        throwError(() => ({ statusCode: 404, message: 'Not registered' })),
      );
      await expect(
        controller['rpc']('get_registration_by_class_and_user', {
          classId: 1,
          userId: 'u',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps 400 to BadRequestException', async () => {
      client.send.mockReturnValue(
        throwError(() => ({ statusCode: 400, message: 'Bad input' })),
      );
      await expect(
        controller['rpc']('update_registration', { id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps unknown errors to InternalServerErrorException', async () => {
      client.send.mockReturnValue(throwError(() => ({ message: 'boom' })));
      await expect(
        controller['rpc']('update_registration', { id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('propagates successful values', async () => {
      client.send.mockReturnValue(of({ id: 5 }));
      await expect(
        controller['rpc']('get_registration', { id: 5 }),
      ).resolves.toEqual({ id: 5 });
    });
  });

  describe('auth checks', () => {
    it('rejects unauthenticated createRegistration', async () => {
      await expect(
        controller.createRegistration(buildRequest(), 1, 'user-1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('forbids registering another user', async () => {
      await expect(
        controller.createRegistration(buildRequest(sessionUserId), 1, 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows self-registration for an open class', async () => {
      classesClient.send.mockReturnValue(
        of({ id: 1, capacity: 10, endDate: '2099-01-01T00:00:00.000Z' }),
      );
      client.send.mockReturnValue(of({ id: 1 }));
      await expect(
        controller.createRegistration(
          buildRequest(sessionUserId),
          1,
          sessionUserId,
        ),
      ).resolves.toEqual({ id: 1 });
      expect(client.send).toHaveBeenCalledWith(
        { cmd: 'create_registration' },
        { classId: 1, userId: sessionUserId, capacity: 10 },
      );
    });

    it('forbids registration for an ended class', async () => {
      classesClient.send.mockReturnValue(
        of({ id: 1, endDate: '2000-01-01T00:00:00.000Z' }),
      );
      await expect(
        controller.createRegistration(
          buildRequest(sessionUserId),
          1,
          sessionUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('requires yoga experience for a private class', async () => {
      classesClient.send.mockReturnValue(
        of({
          id: 1,
          capacity: 10,
          isPrivate: true,
          endDate: '2099-01-01T00:00:00.000Z',
        }),
      );

      await expect(
        controller.createRegistration(
          buildRequest(sessionUserId),
          1,
          sessionUserId,
        ),
      ).rejects.toMatchObject({
        message: 'Yoga experience is required for this class',
      });
      expect(client.send).not.toHaveBeenCalled();
    });

    it('allows a private-class registration when experience exists', async () => {
      classesClient.send.mockReturnValue(
        of({
          id: 1,
          capacity: 10,
          isPrivate: true,
          endDate: '2099-01-01T00:00:00.000Z',
        }),
      );
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({ yogaExperience: 'Five years of yoga' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      client.send.mockReturnValue(of({ id: 1 }));

      await expect(
        controller.createRegistration(
          buildRequest(sessionUserId),
          1,
          sessionUserId,
        ),
      ).resolves.toEqual({ id: 1 });
    });

    it('rejects banned users', async () => {
      classesClient.send.mockReturnValue(
        of({ id: 1, capacity: 10, endDate: '2099-01-01T00:00:00.000Z' }),
      );
      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({ banned: true }), { status: 200 }),
      );

      await expect(
        controller.createRegistration(
          buildRequest(sessionUserId),
          1,
          sessionUserId,
        ),
      ).rejects.toMatchObject({ message: 'User is banned' });
    });

    it('rejects canceled classes', async () => {
      classesClient.send.mockReturnValue(
        of({
          id: 1,
          capacity: 10,
          status: 'Canceled',
          endDate: '2099-01-01T00:00:00.000Z',
        }),
      );

      await expect(
        controller.createRegistration(
          buildRequest(sessionUserId),
          1,
          sessionUserId,
        ),
      ).rejects.toMatchObject({
        message: 'This class is not open for registration',
      });
    });
  });
});
