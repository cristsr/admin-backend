import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { AccountLookups, AccountRepository } from '@app/account/domain/account';
import { AccountOutputDto } from '../dto';
import { AccountMapper } from '../mappers';

@Injectable()
export class FindAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(id: number, user: number): Promise<Nullable<AccountOutputDto>> {
    const account = await this.accountRepository.firstMatching(AccountLookups.byIdAndUser(id, user));

    if (!account) {
      return null;
    }

    const movementBalance = await this.accountRepository.movementBalance(account.id, user);

    return AccountMapper.toOutputWithBalance(account, movementBalance);
  }
}
