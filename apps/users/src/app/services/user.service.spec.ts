import { Test, TestingModule } from '@nestjs/testing';

import { UserHandler } from '../handlers/user.handler';
import { UserService } from './user.service';

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
