import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { ProjectionRegistry } from './projection-registry';

class StubProjector extends Projector {
  readonly name = 'stub';
  readonly consumes: readonly string[] = [];
  async project(_event: StoredEvent, _store: ReadModelStore): Promise<void> {}
}

class AnotherStub extends Projector {
  readonly name = 'another';
  readonly consumes: readonly string[] = [];
  async project(_event: StoredEvent, _store: ReadModelStore): Promise<void> {}
}

describe('ProjectionRegistry', () => {
  let registry: ProjectionRegistry;

  beforeEach(() => {
    registry = new ProjectionRegistry();
  });

  it('returns projectors and tables registered for a name', () => {
    const projector = new StubProjector();
    registry.register('test_proj', [projector], ['test_table']);

    const entry = registry.get('test_proj');
    expect(entry.projectors).toEqual([projector]);
    expect(entry.tables).toEqual(['test_table']);
  });

  it('throws when a name is not registered', () => {
    expect(() => registry.get('unknown')).toThrow(/unknown/);
  });

  it('lists all registered names via names()', () => {
    registry.register('a', [new StubProjector()], ['t_a']);
    registry.register('b', [new AnotherStub()], ['t_b']);

    const names = registry.names();
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toHaveLength(2);
  });

  it('returns empty array when no projections are registered', () => {
    expect(registry.names()).toEqual([]);
  });

  it('allows registering multiple projectors for one projection', () => {
    const p1 = new StubProjector();
    const p2 = new AnotherStub();
    registry.register('multi', [p1, p2], ['t1', 't2']);

    const entry = registry.get('multi');
    expect(entry.projectors).toHaveLength(2);
    expect(entry.tables).toEqual(['t1', 't2']);
  });
});
