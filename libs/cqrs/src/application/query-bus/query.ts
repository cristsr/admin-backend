/**
 * Base for every query. `TResult` is the shape its handler must return, carried
 * through the bus so `ask` infers it instead of the call site asserting it.
 *
 * The bus routes on the concrete class, not on `queryType`: the literal is what
 * keeps two queries of identical shape distinct types, and it doubles as the
 * human-readable label in errors and logs, which `constructor.name` cannot be
 * trusted to give under a minified build.
 */
export abstract class Query<TResult = unknown> {
  /**
   * Phantom carrier for `TResult`. A type parameter the class never mentions is
   * unusable for inference; `declare` keeps this one type-only, emitting no
   * runtime field.
   */
  protected declare readonly _result: TResult;

  abstract readonly queryType: string;
}

/** The result type a query declares, as seen by its handler and by `ask`. */
export type QueryResultOf<TQuery> = TQuery extends Query<infer TResult> ? TResult : never;
