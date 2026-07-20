import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { AccountRepository } from '@app/account/domain/account';
import { AccountOutputDto } from '../dto';
import { UserAccountFilterDto } from '../dto/account-filter.dto';
import { AccountMapper } from '../mappers';

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

    return AccountMapper.toOutputWithBalance(account, movementBalance);
  }
}
