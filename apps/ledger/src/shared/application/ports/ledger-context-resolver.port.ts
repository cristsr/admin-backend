import { Nullable } from '@shared';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';

/** The raw header bag a resolver inspects, decoupled from any HTTP framework. */
export type RequestHeaders = Record<string, string | string[] | undefined>;

/**
 * Port that turns a request's headers into a {@link LedgerContext}, or `null`
 * when the context is absent or malformed. Abstracting the mechanism (gateway
 * headers / JWT / mTLS) keeps the driving adapter free of that open decision
 * (spec pregunta #5): swapping the binding changes nothing in the controllers.
 * Modelled as an abstract class so it doubles as a Nest injection token.
 */
export abstract class LedgerContextResolver {
  abstract resolve(headers: RequestHeaders): Nullable<LedgerContext>;
}
