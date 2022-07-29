import { Test, TestingModule } from '@nestjs/testing';
import { Auth } from './auth.controller';
import { AuthService } from '../services/auth.service';

describe('AuthController', () => {
  let controller: Auth;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Auth],
      providers: [AuthService],
    }).compile();

    controller = module.get<Auth>(Auth);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
