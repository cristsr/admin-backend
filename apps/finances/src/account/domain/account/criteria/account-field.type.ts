/**
 * Every account attribute a criteria may name. `user` stays internal — the use
 * case pins it from the authenticated principal.
 */
export type AccountField =
  'id' | 'user' | 'name' | 'currency' | 'initialBalance' | 'allowsNegativeBalance' | 'createdAt';
