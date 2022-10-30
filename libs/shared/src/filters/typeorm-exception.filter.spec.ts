import { TypeormExceptionFilter } from './typeorm-exception.filter';

describe('TypeormFilter', () => {
  it('should be defined', () => {
    expect(new TypeormExceptionFilter()).toBeDefined();
  });
});
