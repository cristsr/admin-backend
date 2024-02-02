import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountEntity } from 'app/account/entities';
import { MovementEntity } from 'app/movement/entities';
import { AccountService } from './account.service';

describe('SummaryController', () => {
  let module: TestingModule;
  let service: AccountService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: getRepositoryToken(AccountEntity),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MovementEntity),
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be call income to expense ', () => {
    const event = {
      previous: {
        account: {
          id: 1,
          balance2: 60000,
        },
        amount: 70000,
        type: 'income',
      },
      current: {
        account: {
          id: 1,
          balance2: 60000,
        },
        amount: 60000,
        type: 'expense',
      },
    };

    const repository = module.get(getRepositoryToken(AccountEntity));

    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue({});

    expect(saveSpy).toHaveBeenCalledWith({
      id: 1,
      balance2: -70000,
    });
  });

  it('should be call expense to income', () => {
    const event = {
      previous: {
        amount: 60000,
        type: 'expense',
      },
      current: {
        account: {
          id: 1,
          balance2: 60000,
        },
        amount: 70000,
        type: 'income',
      },
    };

    // Al balance se le suma el anterior gasto para nivelarlo y se le suma el nuevo valor del movimiento
    // 60k + 70k + 60k = 190
    // 60k + 60k + 70k = 190

    const repository = module.get(getRepositoryToken(AccountEntity));

    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue({});

    expect(saveSpy).toHaveBeenCalledWith({
      id: 1,
      balance2: 190000,
    });
  });

  it('should be call expense to expense', () => {
    const event = {
      previous: {
        amount: 60000,
        type: 'expense',
      },
      current: {
        account: {
          id: 1,
          balance2: 60000,
        },
        amount: 70000,
        type: 'expense',
      },
    };

    const repository = module.get(getRepositoryToken(AccountEntity));

    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue({});

    expect(saveSpy).toHaveBeenCalledWith({
      id: 1,
      balance2: 50000,
    });
  });

  it('should be call income to income', () => {
    const event = {
      previous: {
        amount: 60000,
        type: 'income',
      },
      current: {
        account: {
          id: 1,
          balance2: 70000,
        },
        amount: 60000,
        type: 'income',
      },
    };

    // 60k 70k 60k

    // prev > curr
    // 60k -10

    const repository = module.get(getRepositoryToken(AccountEntity));

    const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue({});

    expect(saveSpy).toHaveBeenCalledWith({
      id: 1,
      balance2: 70000,
    });
  });
});
