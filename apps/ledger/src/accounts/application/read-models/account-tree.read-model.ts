/**
 * Read-model table name for the account tree.
 *
 * Declared by the application layer, not by the projector that writes it: a
 * table name is what the use cases ask for, so owning it here is what keeps
 * `application` from importing `infrastructure` just to name a query target.
 * `AccountTreeProjector` remains its only writer (Art. 10).
 */
export const PROJ_ACCOUNTS = 'proj_accounts';
