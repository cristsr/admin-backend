export class CurrencyOutputDto {
  constructor(
    readonly code: string,
    readonly minorUnits: number,
    readonly name: string,
  ) {}
}
