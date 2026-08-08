/** One currency as the API exposes it. */
export type CurrencyView = {
  readonly code: string;
  readonly minorUnits: number;
  readonly name: string;
};
