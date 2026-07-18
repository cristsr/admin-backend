import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { AccountRepository } from '../../domain/account';
import { AccountMapper } from '../mappers';
import { AccountOutputDto } from '../dto';
import { UserAccountFilterDto } from '../dto/account-filter.dto';

@Injectable()
export class FindAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(
    filter: UserAccountFilterDto,
    user: number,
  ): Promise<Nullable<AccountOutputDto>> {
    const account = await this.accountRepository.findByIdAndUser(
      filter.account,
      user,
    );
    if (!account) {
      return null;
    }

    const movementBalance = await this.accountRepository.movementBalance(
      account.id,
      user,
    );

    return {
      ...AccountMapper.toOutput(account),
      balance: account.initialBalance + movementBalance,
    };
  }
}
