export class RegisterCurrencyCommand {
  constructor(
    readonly userId: string,
    readonly code: string,
    readonly minorUnits: number,
    readonly name: string,
  ) {}
}
