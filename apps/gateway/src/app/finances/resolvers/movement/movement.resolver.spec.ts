import { Test, TestingModule } from '@nestjs/testing';
import { MovementResolver } from './movement.resolver';

describe('MovementResolver', () => {
  let resolver: MovementResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MovementResolver],
    }).compile();

    resolver = module.get<MovementResolver>(MovementResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
