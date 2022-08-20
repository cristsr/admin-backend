import { Test, TestingModule } from '@nestjs/testing';
import { ScheduledResolver } from './scheduled.resolver';

describe('ScheduledResolver', () => {
  let resolver: ScheduledResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduledResolver],
    }).compile();

    resolver = module.get<ScheduledResolver>(ScheduledResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
