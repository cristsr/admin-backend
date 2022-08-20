import { Test, TestingModule } from '@nestjs/testing';
import { MovementHandler } from './movement.handler';

describe('MovementService', () => {
  let service: MovementHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MovementHandler],
    }).compile();

    service = module.get<MovementHandler>(MovementHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
