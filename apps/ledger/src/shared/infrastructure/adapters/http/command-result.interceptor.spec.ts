import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { CommandResult } from '@ledger/shared/application/ep1-contracts.assumed';
import { CommandResultInterceptor, STREAM_POSITION_HEADER } from './command-result.interceptor';
import { CommandAcceptedDto } from './dto/command-accepted.dto';

describe('CommandResultInterceptor', () => {
  const interceptor = new CommandResultInterceptor();

  const run = async (returned: unknown) => {
    const setHeader = jest.fn();
    const status = jest.fn();
    const context = {
      switchToHttp: () => ({ getResponse: () => ({ setHeader, status }) }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(returned) };

    const result = await firstValueFrom(interceptor.intercept(context, next));
    return { result, setHeader, status };
  };

  const commandResult = (overrides: Partial<CommandResult> = {}): CommandResult => ({
    aggregateId: 'agg-1',
    sequence: 1,
    streamPosition: 42,
    idempotentReplay: false,
    ...overrides,
  });

  it('maps a command result to CommandAcceptedDto and stamps the stream position header', async () => {
    const { result, setHeader, status } = await run(commandResult());

    expect(result).toBeInstanceOf(CommandAcceptedDto);
    expect(result).toEqual({ id: 'agg-1', sequence: 1, streamPosition: 42 });
    expect(setHeader).toHaveBeenCalledWith(STREAM_POSITION_HEADER, '42');
    expect(status).not.toHaveBeenCalled();
  });

  it('downgrades an idempotent replay to 200', async () => {
    const { status } = await run(commandResult({ idempotentReplay: true }));

    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('never leaks internal fields (aggregateId is mapped to id, replay flag dropped)', async () => {
    const { result } = await run(commandResult());

    expect(result).not.toHaveProperty('aggregateId');
    expect(result).not.toHaveProperty('idempotentReplay');
  });

  it('passes a read projection through untouched', async () => {
    const projection = { view: 'tree', accounts: [] };
    const { result, setHeader } = await run(projection);

    expect(result).toBe(projection);
    expect(setHeader).not.toHaveBeenCalled();
  });
});
