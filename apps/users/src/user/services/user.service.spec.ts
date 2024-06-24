import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [UserService],
      providers: [UserService],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Welcome to users!"', () => {
      const appController = app.get<UserService>(UserService);
      expect(appController.findOne({})).toEqual({
        message: 'Welcome to users!',
      });
    });
  });
});
