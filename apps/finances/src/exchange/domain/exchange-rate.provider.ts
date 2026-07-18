/**
 * Provee la tasa de conversión entre dos monedas a una fecha dada. La fuente es
 * el microservicio `exchanges` (a reactivar). Política carry-forward: si no hay
 * tasa exacta para la fecha, se usa la más cercana anterior (AC-2).
 */
export abstract class ExchangeRateProvider {
  /** Tasa para convertir un monto de `from` a `to` en `date`. */
  abstract getRate(from: string, to: string, date: Date): Promise<number>;
}
