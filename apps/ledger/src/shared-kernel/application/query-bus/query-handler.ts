import { Query } from './query';

/**
 * Scope every query carries. Reads never cross users (INV-9); the handler
 * filters strictly by `userId`.
 */
export type QueryContext = {
  readonly userId: string;
};

/** Handles one query type, reading only from read models (RNF-10). */
export abstract class QueryHandler<TQuery extends Query, TResult> {
  abstract execute(query: TQuery, ctx: QueryContext): Promise<TResult>;
}
