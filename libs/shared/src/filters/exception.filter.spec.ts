import { HttpStatus, NotFoundException } from '@nestjs/common';
import { DomainNotFoundException } from '../exceptions';
import { ExceptionFilter } from './exception.filter';

class AccountNotFoundException extends DomainNotFoundException {
  readonly code = 'ACCOUNT_NOT_FOUND';
}

describe('ExceptionFilter', () => {
  const capture = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/movements/7' }),
      }),
    } as never;

    return { host, status, body: () => json.mock.calls[0][0] };
  };

  it('answers a domain not-found with its own status, not a generic 500', () => {
    const { host, status, body } = capture();

    new ExceptionFilter().catch(
      new AccountNotFoundException('Account not found'),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(body()).toMatchObject({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'AccountNotFoundException',
      message: 'Account not found',
      code: 'ACCOUNT_NOT_FOUND',
      path: '/movements/7',
    });
  });

  /**
   * The filter used to wrap every failure in a gRPC status envelope, so a 404
   * went out as `{ code: 10 }` — gRPC's ABORTED — to HTTP clients.
   */
  it('emits no gRPC status envelope', () => {
    const { host, body } = capture();

    new ExceptionFilter().catch(new NotFoundException('Nope'), host);

    expect(body()).not.toHaveProperty('metadata');
    expect(body().code).toBeUndefined();
    expect(body().statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('keeps an HttpException status untouched', () => {
    const { host, status } = capture();

    new ExceptionFilter().catch(new NotFoundException('Nope'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('falls back to 500 for anything unrecognized', () => {
    const { host, status, body } = capture();

    new ExceptionFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body()).toMatchObject({ error: 'Error', message: 'boom' });
  });
});
