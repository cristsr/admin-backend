import { Currency } from '@ledger/shared/domain/money';
import { CurrencyCode } from './currency-code';

/**
 * Resolves a {@link CurrencyCode} to its {@link Currency} (code + minor units),
 * the scale `Money` enforces (INV-8). A port so the seed catalog can be swapped
 * for the `CurrencyRegistered` projection in EP-4 without touching the core.
 */
export abstract class CurrencyCatalog {
  /** Throws {@link UnknownCurrencyException} when the code is not registered. */
  abstract resolve(code: CurrencyCode): Currency;
}
