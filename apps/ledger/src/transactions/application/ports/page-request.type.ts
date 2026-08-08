/** A page request; absent fields fall back to the use case's default. */
export type PageRequest = {
  readonly limit: number;
  readonly offset: number;
};
