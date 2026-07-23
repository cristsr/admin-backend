/**
 * Net worth snapshot by account type and presentation currency.
 */
export class NetWorthComponentDto {
  constructor(
    readonly accountType: string,
    readonly valuedAmount: string,
    readonly presentationCurrency: string,
  ) {}
}

export class NetWorthOutputDto {
  constructor(
    readonly totalNetWorth: string,
    readonly components: NetWorthComponentDto[],
    readonly presentationCurrency: string,
    readonly asOf: Date,
  ) {}
}
