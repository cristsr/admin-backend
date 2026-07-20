import { Injectable } from '@nestjs/common';
import {
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import { AccountBalanceOutputDto } from '../dto';

@Injectable()
export class GetAccountBalanceUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(id: number, user: number): Promise<AccountBalanceOutputDto> {
    const account = await this.accountRepository.findByIdAndUser(id, user);
    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const movementBalance = await this.accountRepository.movementBalance(
      id,
      user,
    );

    const balance = account.liveBalance(movementBalance);

    return {
      accountId: account.id,
      balance: balance.amount,
      currency: balance.currency,
    };
  }
}
