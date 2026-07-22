import { Injectable } from '@nestjs/common';
import { AccountLookups, AccountNotFoundException, AccountRepository } from '@app/account/domain/account';
import { AccountArchivedOutputDto } from '../dto';

@Injectable()
export class RemoveAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  /**
   * Soft-deletes the account in cascade: its movements and both legs of every
   * transfer it participates in go too, so no transfer is left half-valid.
   */
  async execute(id: number, user: number): Promise<AccountArchivedOutputDto> {
    const account = await this.accountRepository.firstMatching(AccountLookups.byIdAndUser(id, user));

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const { archivedMovements, archivedTransfers } = await this.accountRepository.archiveCascade(id, user);

    return { accountId: id, archivedMovements, archivedTransfers };
  }
}
