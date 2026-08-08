import { Query, QueryResultOf } from './query';

/**
 * Scope every query carries. Reads never cross users (INV-9); the handler
 * filters strictly by `userId`.
 */
export type QueryContext = {
  readonly userId: string;
};

/**
 * Handles one query type, reading only from read models. The result is the one
 * the query declares — a handler cannot disagree with its own query about what
 * a read returns.
 */
export abstract class QueryHandler<TQuery extends Query<unknown>> {
  abstract execute(query: TQuery, ctx: QueryContext): Promise<QueryResultOf<TQuery>>;
}
