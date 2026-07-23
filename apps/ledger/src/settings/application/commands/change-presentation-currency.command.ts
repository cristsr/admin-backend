/**
 * Command to change the user's presentation currency.
 */
export class ChangePresentationCurrencyCommand {
  constructor(
    readonly userId: string,
    readonly presentationCurrency: string,
    readonly externalRef?: string,
  ) {}
}
