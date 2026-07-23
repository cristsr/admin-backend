import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { DomainException, ExceptionFilter } from '@shared';
import {
  AccountClosedException,
  AccountNotFoundException,
  ConcurrencyConflictException,
  CurrencyNotAllowedException,
  DuplicateExternalRefException,
  ImmutableTransactionException,
  LedgerNotInitializedException,
  NameCollisionException,
  SystemAccountProtectedException,
  TransactionNotFoundException,
  UnbalancedTransactionException,
} from '@ledger/shared/domain/ep1-contracts.assumed';
import { LEDGER_ERROR_CODE } from './ledger-error-code';

/**
 * Freezes the RF-14 code → HTTP status contract (EP-2.6): the API's stable error
 * surface. Adding a code obliges adding a row here; changing a status here is a
 * breaking API change. The mapping is verified end-to-end through the shared
 * exception filter, exactly as a client would observe it.
 */
describe('Ledger error code → HTTP status contract (RF-14)', () => {
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
    [new AccountClosedException('closed'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.ACCOUNT_CLOSED],
    [new ImmutableTransactionException('immutable'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.IMMUTABLE_TRANSACTION],
    [new NameCollisionException('collision'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.NAME_COLLISION],
    [new SystemAccountProtectedException('protected'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.SYSTEM_ACCOUNT_PROTECTED],
    [new ConcurrencyConflictException('conflict'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.CONCURRENCY_CONFLICT],
    [new DuplicateExternalRefException('duplicate'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.DUPLICATE_EXTERNAL_REF],
    [new LedgerNotInitializedException('not initialized'), HttpStatus.CONFLICT, LEDGER_ERROR_CODE.LEDGER_NOT_INITIALIZED],
    [new AccountNotFoundException('no account'), HttpStatus.NOT_FOUND, LEDGER_ERROR_CODE.ACCOUNT_NOT_FOUND],
    [new TransactionNotFoundException('no transaction'), HttpStatus.NOT_FOUND, LEDGER_ERROR_CODE.TRANSACTION_NOT_FOUND],
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
