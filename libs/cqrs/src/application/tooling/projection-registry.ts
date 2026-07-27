import { Projector } from '@cqrs/application/projection/projector';

export type ProjectionEntry = {
  readonly projectors: readonly Projector[];
  readonly tables: readonly string[];
};

export class ProjectionRegistry {
  private readonly entries = new Map<string, ProjectionEntry>();

  register(name: string, projectors: readonly Projector[], tables: readonly string[]): void {
    this.entries.set(name, { projectors, tables });
  }

  get(name: string): ProjectionEntry {
    const entry = this.entries.get(name);

    if (!entry) {
      throw new Error(`Projection "${name}" is not registered`);
    }

    return entry;
  }

  names(): readonly string[] {
    return [...this.entries.keys()];
  }
}
