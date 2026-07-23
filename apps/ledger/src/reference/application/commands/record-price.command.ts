export class RecordPriceCommand {
  constructor(
    readonly userId: string,
    readonly base: string,
    readonly quote: string,
    readonly date: string,
    readonly rate: string,
    readonly source: string,
  ) {}
}
