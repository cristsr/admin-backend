import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import {
  ConcurrencyConflictException,
  DuplicateExternalRefException,
} from '@cqrs/domain/exceptions/event-store.exception';
import { DomainException, ExceptionFilter } from '@shared';
import {
  AccountClosedException,
  CurrencyNotAllowedException,
  NameCollisionException,
  SystemAccountProtectedException,
} from '@ledger/accounts/domain/account/exceptions/account.exception';
import { AccountNotFoundException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { LEDGER_ERROR_CODE } from '@ledger/shared/domain/errors/ledger-error-code';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';
import {
  CurrencyMismatchException,
  InvalidCurrencyException,
  InvalidMoneyException,
  MoneyScaleException,
} from '@ledger/shared/domain/money/money.exception';
import {
  InvalidCurrencyCodeException,
  InvalidTimeZoneException,
} from '@ledger/shared/domain/value-objects';
import {
  ImmutableTransactionException,
  TransactionNotFoundException,
  UnbalancedTransactionException,
} from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';

/**
 * Freezes the code → HTTP status contract: the API's stable error
 * surface. Adding a code obliges adding a row here; changing a status here is a
 * breaking API change. The mapping is verified end-to-end through the shared
 * exception filter, exactly as a client would observe it.
 */
describe('Ledger error code → HTTP status contract', () => {
  const capture = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/v1/transactions' }),
      }),
    } as unknown as ArgumentsHost;

    return { host, status, body: () => json.mock.calls[0][0] };
  };

  const cases: ReadonlyArray<[DomainException, number, string]> = [
    [new UnbalancedTransactionException('unbalanced'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.UNBALANCED_TRANSACTION],
    [new CurrencyNotAllowedException('bad currency'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.CURRENCY_NOT_ALLOWED],
    // Divergence from the contract the HTTP layer assumed: `AccountClosedException`
    // is an unprocessable-entity (INV-3, posting to a closed account), not a conflict.
    [new AccountClosedException('closed'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.ACCOUNT_CLOSED],
    [new ImmutableTransactionException('immutable'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.IMMUTABLE_TRANSACTION],
    [new NameCollisionException('collision'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.NAME_COLLISION],
    [new SystemAccountProtectedException('protected'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.SYSTEM_ACCOUNT_PROTECTED],
    [new ConcurrencyConflictException('conflict'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.CONCURRENCY_CONFLICT],
    [new DuplicateExternalRefException('duplicate'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.DUPLICATE_EXTERNAL_REF],
    [new AccountNotFoundException('no account'), HttpStatus.NOT_FOUND, LEDGER_ERROR_CODE.ACCOUNT_NOT_FOUND],
    [new TransactionNotFoundException('no transaction'), HttpStatus.NOT_FOUND, LEDGER_ERROR_CODE.TRANSACTION_NOT_FOUND],
    [new LedgerNotInitializedException('not initialized'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.LEDGER_NOT_INITIALIZED],
    [new InvalidCurrencyCodeException('Invalid currency code: XX'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_CURRENCY_CODE],
    [new InvalidTimeZoneException('Invalid IANA timezone: Bogota'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_TIME_ZONE],
    [new InvalidMoneyException('not a decimal'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_MONEY],
    [new CurrencyMismatchException('USD vs COP'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.CURRENCY_MISMATCH],
    [new MoneyScaleException('too many decimals'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.MONEY_SCALE],
    [new InvalidCurrencyException('blank code'), HttpStatus.UNPROCESSABLE_ENTITY, LEDGER_ERROR_CODE.INVALID_CURRENCY],
  ];

  it.each(cases)('maps %s to its stable status and code', (exception, expectedStatus, expectedCode) => {
    const { host, status, body } = capture();

    new ExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(body()).toMatchObject({ statusCode: expectedStatus, code: expectedCode });
  });

  it('does not leak a domain code for an unknown error (500)', () => {
    const { host, status, body } = capture();

    new ExceptionFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body().code).toBeUndefined();
  });
});
