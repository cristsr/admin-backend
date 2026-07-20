import { Injectable } from '@nestjs/common';
import { CriteriaQueryDto } from '@shared';
import {
  AccountCriteria,
  AccountRepository,
} from '@app/account/domain/account';
import { AccountOutputDto } from '../dto';
import { AccountMapper } from '../mappers';

@Injectable()
export class FindAllAccountsUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(
    query: CriteriaQueryDto,
    user: number,
  ): Promise<AccountOutputDto[]> {
    const [accounts, balances] = await Promise.all([
      this.accountRepository.matching(AccountCriteria.list(query, user)),
      this.accountRepository.movementBalancesByUser(user),
    ]);

    return accounts.map((account) =>
      AccountMapper.toOutputWithBalance(account, balances[account.id] ?? 0),
    );
  }
}
