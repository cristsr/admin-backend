import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { UserRepository } from 'app/user/repositories';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  const userRepository = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    service = app.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('maps a removal result to a status flag', async () => {
    userRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(firstValueFrom(service.remove({ id: 1 }))).resolves.toEqual({
      status: true,
    });
    expect(userRepository.delete).toHaveBeenCalledWith({ id: 1 });
  });
});
