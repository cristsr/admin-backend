import { DomainUnprocessableException } from '@shared';
import { Query, QueryResultOf } from './query';
import { QueryContext, QueryHandler } from './query-handler';

/** No handler is registered for a dispatched query type. */
export class UnregisteredQueryException extends DomainUnprocessableException {
  readonly code: string = 'UNREGISTERED_QUERY';
}

/**
 * Constructor of a concrete query. The bus routes on this reference, so
 * `register` correlates a query with the one handler that serves it and a
 * mismatched pair fails to compile instead of at the first request.
 */
export type QueryCtor<TQuery extends Query<unknown>> = new (...args: never[]) => TQuery;

/** Routes queries to their handler. Read-only, no domain logic. */
export abstract class QueryBus {
  abstract ask<TQuery extends Query<unknown>>(
    query: TQuery,
    ctx: QueryContext,
  ): Promise<QueryResultOf<TQuery>>;
}

/** Registry-backed query bus. */
export class RegistryQueryBus extends QueryBus {
  private readonly handlers = new Map<QueryCtor<Query<unknown>>, QueryHandler<Query<unknown>>>();

  register<TQuery extends Query<unknown>>(
    query: QueryCtor<TQuery>,
    handler: QueryHandler<TQuery>,
  ): void {
    this.handlers.set(
      query as QueryCtor<Query<unknown>>,
      handler as unknown as QueryHandler<Query<unknown>>,
    );
  }

  /**
   * Queries that currently resolve to a handler, for the same reason the
   * command bus exposes its own: a controller asking a query nobody registered
   * only fails once a request reaches it.
   */
  registeredTypes(): readonly QueryCtor<Query<unknown>>[] {
    return [...this.handlers.keys()];
  }

  async ask<TQuery extends Query<unknown>>(
    query: TQuery,
    ctx: QueryContext,
  ): Promise<QueryResultOf<TQuery>> {
    const handler = this.handlers.get(query.constructor as QueryCtor<Query<unknown>>);

    if (!handler) {
      throw new UnregisteredQueryException(`No handler registered for "${query.queryType}"`);
    }

    return handler.execute(query, ctx) as Promise<QueryResultOf<TQuery>>;
  }
}
