import { DomainUnprocessableException } from '@shared';
import { Query } from './query';
import { QueryContext, QueryHandler } from './query-handler';

/** No handler is registered for a dispatched query type. */
export class UnregisteredQueryException extends DomainUnprocessableException {
  readonly code: string = 'UNREGISTERED_QUERY';
}

/** Routes queries to their handler. Read-only, no domain logic (RNF-10). */
export abstract class QueryBus {
  abstract ask<TResult>(query: Query, ctx: QueryContext): Promise<TResult>;
}

/** Registry-backed query bus. */
export class RegistryQueryBus extends QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query, unknown>>();

  register(queryType: string, handler: QueryHandler<Query, unknown>): void {
    this.handlers.set(queryType, handler);
  }

  async ask<TResult>(query: Query, ctx: QueryContext): Promise<TResult> {
    const handler = this.handlers.get(query.queryType);

    if (!handler) {
      throw new UnregisteredQueryException(`No handler registered for "${query.queryType}"`);
    }

    return handler.execute(query, ctx) as Promise<TResult>;
  }
}
