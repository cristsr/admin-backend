// ASSUMED EP-1 CONTRACTS — replace at integration.
//
// The command/query buses and their result type belong to EP-1 (the CQRS core),
// built in a parallel worktree and absent here. EP-2 depends only on these
// abstractions (DIP): the HTTP adapter translates requests into commands/queries
// and dispatches them, nothing more (RNF-10). At integration, delete this file
// and import the real buses from EP-1's application layer; the tokens
// (`CommandBus`, `QueryBus`) and the `CommandResult` shape must be preserved.
import { Global, Injectable, Module } from '@nestjs/common';
import { Nullable } from '@shared';

/**
 * Everything a write returns (RNF-10): generated identifiers plus the stream
 * position reached, for read-your-writes (RNF-9). Never a read view.
 */
export interface CommandResult {
  readonly aggregateId: string;
  readonly sequence: number;
  readonly streamPosition: number;
  /** True when the append was a no-op idempotent replay of a prior `external_ref` (INV-10). */
  readonly idempotentReplay: boolean;
}

/** Marker every write command shares: the authenticated context and idempotency key. */
export interface LedgerCommand {
  readonly userId: string;
  readonly clientId: string;
  readonly externalRef: Nullable<string>;
}

/** Marker every read query shares: the owning user that partitions the ledger (INV-9). */
export interface LedgerQuery {
  readonly userId: string;
}

/** Write side. Resolves the handler and applies idempotency, context and concurrency. */
export abstract class CommandBus {
  abstract dispatch<TResult extends CommandResult>(command: LedgerCommand): Promise<TResult>;
}

/** Read side. Serves projections only — no domain, no event store (RNF-10). */
export abstract class QueryBus {
  abstract ask<TResult>(query: LedgerQuery): Promise<TResult>;
}

/** Signals a bus was called in a build where EP-1 is not wired. */
class Ep1NotIntegratedException extends Error {
  constructor(port: string) {
    super(`${port} is not wired: EP-1 core is not integrated in this build.`);
    this.name = Ep1NotIntegratedException.name;
  }
}

@Injectable()
class UnavailableCommandBus extends CommandBus {
  dispatch<TResult extends CommandResult>(): Promise<TResult> {
    throw new Ep1NotIntegratedException(CommandBus.name);
  }
}

@Injectable()
class UnavailableQueryBus extends QueryBus {
  ask<TResult>(): Promise<TResult> {
    throw new Ep1NotIntegratedException(QueryBus.name);
  }
}

/**
 * Placeholder providers so the module graph resolves and the wiring test passes
 * without EP-1. Replaced wholesale by EP-1's bus module at integration; the
 * stubs throw if ever invoked, so an accidental runtime dependency surfaces loudly.
 */
@Global()
@Module({
  providers: [
    { provide: CommandBus, useClass: UnavailableCommandBus },
    { provide: QueryBus, useClass: UnavailableQueryBus },
  ],
  exports: [CommandBus, QueryBus],
})
export class AssumedEp1BusModule {}
