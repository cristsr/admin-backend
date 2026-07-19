import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { UserService } from 'app/user/services';
import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;
  const userService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = app.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('resolves a user by its auth0 subject id', () => {
    userService.findOne.mockReturnValue(of({ id: 1 }));

    controller.findBySubId('auth0|abc');

    expect(userService.findOne).toHaveBeenCalledWith({ auth0Id: 'auth0|abc' });
  });
});
