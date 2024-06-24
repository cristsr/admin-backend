import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserController],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Welcome to users!"', () => {
      const appController = app.get<UserController>(UserController);
      expect(appController.findOne({})).toEqual({
        message: 'Welcome to users!',
      });
    });
  });
});
