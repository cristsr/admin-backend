export class PriceOutputDto {
  constructor(
    readonly base: string,
    readonly quote: string,
    readonly date: string,
    readonly rate: string,
    readonly source: string,
  ) {}
}
