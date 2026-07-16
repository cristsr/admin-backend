import { Injectable } from '@nestjs/common';
import {
  AccountHasMovementsException,
  AccountNotFoundException,
  AccountRepository,
} from '../../domain/account';

@Injectable()
export class RemoveAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(id: number, user: number): Promise<boolean> {
    const account = await this.accountRepository.findByIdAndUser(id, user);

    if (!account) {
      throw new AccountNotFoundException('Account not found');
    }

    if (await this.accountRepository.hasMovements(id)) {
      throw new AccountHasMovementsException(
        'Account has movements and cannot be deleted',
      );
    }

    return this.accountRepository.softRemove(id, user);
  }
}
