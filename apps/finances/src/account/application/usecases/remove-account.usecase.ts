import { Injectable } from '@nestjs/common';
import {
  AccountNotFoundException,
  AccountRepository,
} from '@app/account/domain/account';
import { AccountArchivedOutputDto } from '../dto';

@Injectable()
export class RemoveAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  /**
   * Archiving an account soft-deletes it in cascade instead of
   * blocking when it has movements: its movements and both legs of every
   * transfer it participates in are soft-deleted too, so no transfer is left
   * half-valid and archived rows stop counting in balances.
   */
  async execute(id: number, user: number): Promise<AccountArchivedOutputDto> {
    const account = await this.accountRepository.findByIdAndUser(id, user);

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    const { archivedMovements, archivedTransfers } = await this.accountRepository.archiveCascade(id, user);

    return { accountId: id, archivedMovements, archivedTransfers };
  }
}
