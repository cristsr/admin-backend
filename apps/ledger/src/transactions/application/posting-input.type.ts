/** API-shaped posting: amount as a decimal string with its currency code (RNF-2). */
export type PostingInput = {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
  readonly metadata?: Readonly<Record<string, string>>;
};
