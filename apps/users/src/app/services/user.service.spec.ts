import { Test, TestingModule } from '@nestjs/testing';

import { UserService } from './user.service';
import { UserHandler } from '../handlers/user.handler';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [UserHandler],
      providers: [UserHandler],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Welcome to users!"', () => {
      const appController = app.get<UserHandler>(UserHandler);
      expect(appController.getData()).toEqual({ message: 'Welcome to users!' });
    });
  });
});
