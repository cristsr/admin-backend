import { Query } from './query';
import { QueryBus, RegistryQueryBus, UnregisteredQueryException } from './query-bus';
import { QueryContext, QueryHandler } from './query-handler';

type GreetingRow = { readonly greeting: string };

class GreetQuery extends Query<readonly GreetingRow[]> {
  readonly queryType = 'Greet';

  constructor(readonly name: string) {
    super();
  }
}

class CountQuery extends Query<number> {
  readonly queryType = 'Count';
}

class GreetHandler extends QueryHandler<GreetQuery> {
  async execute(query: GreetQuery, ctx: QueryContext): Promise<readonly GreetingRow[]> {
    return [{ greeting: `hello ${query.name} from ${ctx.userId}` }];
  }
}

const ctx: QueryContext = { userId: 'user-1' };

describe('RegistryQueryBus', () => {
  let bus: RegistryQueryBus;

  beforeEach(() => {
    bus = new RegistryQueryBus();
  });

  it('should reject an unregistered query', async () => {
    await expect((bus as QueryBus).ask(new CountQuery(), ctx)).rejects.toBeInstanceOf(
      UnregisteredQueryException,
    );
  });

  it('should route a registered query to its handler', async () => {
    bus.register(GreetQuery, new GreetHandler());

    const rows = await bus.ask(new GreetQuery('world'), ctx);

    expect(rows).toEqual([{ greeting: 'hello world from user-1' }]);
  });

  /**
   * The point of `Query<TResult>`: the call site no longer names the result, so
   * it can no longer name it wrongly. `rows` is typed from the query alone.
   */
  it('should infer the result type from the query', async () => {
    bus.register(GreetQuery, new GreetHandler());

    const rows = await bus.ask(new GreetQuery('world'), ctx);

    expect(rows.map((row) => row.greeting)).toEqual(['hello world from user-1']);
  });

  it('should expose the registered queries as their constructors', () => {
    bus.register(GreetQuery, new GreetHandler());

    expect(bus.registeredTypes()).toEqual([GreetQuery]);
  });

  it('should reject a handler that does not serve the registered query', () => {
    // @ts-expect-error -- GreetHandler serves GreetQuery, not CountQuery.
    bus.register(CountQuery, new GreetHandler());
  });
});
