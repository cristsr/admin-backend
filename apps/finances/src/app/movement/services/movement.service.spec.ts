import { Test, TestingModule } from '@nestjs/testing';
import { MovementService } from './movement.service';
import { MovementHandler } from '../handlers/movement.handler';

describe('MovementController', () => {
  let controller: MovementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovementService],
      providers: [MovementHandler],
    }).compile();

    controller = module.get<MovementService>(MovementService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
