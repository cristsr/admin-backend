import { Criteria } from '@shared';
import { MovementField } from './movement-field.type';

/** Identity and ownership lookups that resolve a single movement or an owner's set. */
export class MovementLookups {
  static ownedBy(user: number): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals('user', user);
  }

  static byId(id: number): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals('id', id);
  }

  static byIdAndUser(id: number, user: number): Criteria<MovementField> {
    return MovementLookups.ownedBy(user).equals('id', id);
  }

  /**
   * The movement a webhook delivery already produced. Not user-scoped: the
   * reference is what proves a replay.
   */
  static byExternalReference(externalReference: string): Criteria<MovementField> {
    return Criteria.none<MovementField>().equals('externalReference', externalReference);
  }
}
