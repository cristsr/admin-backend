export class ResolvePriceQuery {
  constructor(
    readonly userId: string,
    readonly base: string,
    readonly quote: string,
    readonly date: string,
    readonly source?: string,
  ) {}
}
