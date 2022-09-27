import { Test } from '@nestjs/testing';

import { UserHandler } from './user.handler';

describe('AppService', () => {
  let service: UserHandler;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [UserHandler],
    }).compile();

    service = app.get<UserHandler>(UserHandler);
  });

  describe('getData', () => {
    it('should return "Welcome to users!"', () => {
      expect(service.getData()).toEqual({ message: 'Welcome to users!' });
    });
  });
});
