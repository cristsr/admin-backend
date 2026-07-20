import { lastValueFrom, of } from 'rxjs';
import {
  IdempotencyConflictException,
  IdempotencyInProgressException,
  IdempotencyKey,
  IdempotencyStatus,
} from '@app/idempotency/domain/idempotency-key';
import { hashRequestBody } from './idempotency-hash';
import { IdempotencyInterceptor } from './idempotency.interceptor';

const BODY = { amount: 100, account: 3 };
const HASH = hashRequestBody(BODY);

const makeContext = (over: any = {}) => {
  const response = { statusCode: 201, status: jest.fn() };
  return {
    ctx: {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: over.headers ?? { 'idempotency-key': 'key-1' },
          body: over.body ?? BODY,
          user: { id: 42 },
          method: 'POST',
          route: { path: '/movements' },
        }),
        getResponse: () => response,
      }),
    },
    response,
  };
};

const completed = (over: Partial<IdempotencyKey> = {}) =>
  IdempotencyKey.create({
    id: 1,
    idempotencyKey: 'key-1',
    userId: 42,
    endpoint: 'POST /movements',
    requestHash: HASH,
    status: IdempotencyStatus.COMPLETED,
    responseStatus: 201,
    responseBody: { id: 1 },
    createdAt: new Date(),
    expiresAt: new Date(),
    ...over,
  } as IdempotencyKey);

describe('IdempotencyInterceptor (AC-3)', () => {
  let repo: any;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    repo = { reserve: jest.fn(), complete: jest.fn() };
    interceptor = new IdempotencyInterceptor(repo);
  });

  it('passes through when no Idempotency-Key header is present', async () => {
    const { ctx } = makeContext({ headers: {} });
    const next = { handle: () => of({ id: 9 }) };

    const out = await lastValueFrom(interceptor.intercept(ctx as any, next as any));

    expect(out).toEqual({ id: 9 });
    expect(repo.reserve).not.toHaveBeenCalled();
  });

  it('stores the response and returns it on first use of a key', async () => {
    repo.reserve.mockResolvedValue({
      created: true,
      row: completed({ status: IdempotencyStatus.PENDING, responseBody: undefined }),
    });
    const { ctx } = makeContext();
    const next = { handle: () => of({ id: 1 }) };

    const out = await lastValueFrom(interceptor.intercept(ctx as any, next as any));

    expect(out).toEqual({ id: 1 });
    expect(repo.complete).toHaveBeenCalledWith(1, 201, { id: 1 });
  });

  it('replays the stored response when same key + same body hash (COMPLETED)', async () => {
    repo.reserve.mockResolvedValue({ created: false, row: completed() });
    const { ctx } = makeContext();
    const handle = jest.fn(() => of({ id: 999 }));
    const next = { handle };

    const out = await lastValueFrom(interceptor.intercept(ctx as any, next as any));

    expect(out).toEqual({ id: 1 });
    expect(handle).not.toHaveBeenCalled();
  });

  it('throws 422 when same key + different body hash', async () => {
    repo.reserve.mockResolvedValue({
      created: false,
      row: completed({ requestHash: 'different-hash' }),
    });
    const { ctx } = makeContext();
    const next = { handle: () => of({ id: 1 }) };

    await expect(
      lastValueFrom(interceptor.intercept(ctx as any, next as any)),
    ).rejects.toBeInstanceOf(IdempotencyConflictException);
  });

  it('throws 409 when the existing key is still PENDING (in progress)', async () => {
    repo.reserve.mockResolvedValue({
      created: false,
      row: completed({ status: IdempotencyStatus.PENDING, responseBody: undefined }),
    });
    const { ctx } = makeContext();
    const next = { handle: () => of({ id: 1 }) };

    await expect(
      lastValueFrom(interceptor.intercept(ctx as any, next as any)),
    ).rejects.toBeInstanceOf(IdempotencyInProgressException);
  });
});
