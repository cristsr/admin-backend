# context: hu-0019

## Historia resumida

**Como** cliente autenticado del ledger
**Quiero** registrar monedas con su precisión decimal vía API y consultarlas
**Para** operar cuentas en monedas que hoy no están sembradas en el código, sin recompilar

## App afectada

`apps/ledger` — módulo nuevo `reference` (o `currencies`), más el cableado en
`ledger-core.module.ts` y el registro en el tooling de rebuild.

---

## El punto que gobierna todo el diseño

**`CurrencyCatalog.resolve(code): Currency` es síncrono.**

```typescript
export abstract class CurrencyCatalog {
  abstract resolve(code: CurrencyCode): Currency;
}
```

Lo consumen **22 archivos**, y no solo desde handlers: se usa dentro de
`fromPayload` de los eventos que llevan montos —`BalanceAsserted`,
`BalanceAssertionEvaluated`, `TransactionRecorded`, `TransactionAmended`—, es decir, en la
**deserialización del stream**. Convertirlo en una lectura asíncrona de proyección
rompería la rehidratación de todo agregado con dinero.

Consecuencias para esta historia:

1. `resolve` **conserva su firma síncrona**. El adaptador nuevo lee de la proyección pero
   sirve desde una caché en memoria hidratada al arrancar y refrescada al registrar.
2. El catálogo es **global** (decisión de AC-2): si fuera por usuario, `resolve` necesitaría
   `userId` y habría que propagarlo hasta `fromPayload`, donde solo existe el envelope.

## Estado actual

**Puerto:** `src/shared-kernel/domain/value-objects/currency-catalog.ts` — su JSDoc ya
anticipa esta historia: *«A port so the seed catalog can be swapped for the
`CurrencyRegistered` projection in EP-4 without touching the core»*.

**Adaptador vigente:** `SeedCurrencyCatalog`
(`shared-kernel/infrastructure/adapters/currency/seed-currency-catalog.ts`) con
`{ COP: 0, USD: 2 }` constante. Lanza `UnknownCurrencyException` para lo demás.

**Cableado:** `ledger-core.module.ts:30` lo provee con `useClass` y lo exporta (línea 51),
así que el módulo entero lo inyecta por token. Cambiar el adaptador es un solo punto.

**Fuera del módulo Nest:** `rebuild.command.ts` construye `new SeedCurrencyCatalog()` a
mano, y varios specs también. Cada uno hay que revisarlo.

**`Currency.of(code, minorUnits)`** ya valida entero no negativo
(`shared/domain/money/currency.ts:20`); falta el techo de 4 (AC-6).

---

## Gaps detectados

1. **Nadie define de dónde sale la caché en el arranque.** El adaptador nuevo necesita
   hidratarse antes del primer `resolve`, y el primer `resolve` puede ocurrir durante la
   rehidratación de un agregado, es decir, muy temprano. Hay que decidir en diseño si se
   hidrata en un hook de arranque de Nest o de forma perezosa con una precarga bloqueante.

2. **`rebuild.command.ts` corre fuera de Nest.** Instancia el catálogo a mano; el adaptador
   nuevo necesita un `DataSource` allí también, o el rebuild no podrá deserializar montos.

3. **AC-8 (monedas semilla) tiene dos caminos y hay que elegir uno.** O una migración
   inserta COP y USD en la proyección, o el adaptador conserva un fallback al seed. Lo
   primero es más limpio; lo segundo evita que un catálogo vacío deje la app inarrancable.

4. **El evento `CurrencyRegistered` no lleva `user_id` significativo.** Todo el
   `EventEnvelope` está tipado con `userId` y el `EventStore` particiona por él (INV-9).
   Un stream global necesita decidir qué `userId` se estampa: un valor de sistema
   reservado, o aceptar el del cliente que registra aunque el dato sea global. Afecta a
   `readAll` y al rebuild.

5. **Alcance real de la historia:** ninguna funcionalidad existente lo necesita. `Money`
   funciona hoy con COP y USD; esto habilita operar en una tercera moneda sin recompilar.
   Es extensibilidad, no corrección — vale tenerlo presente si el gap 4 se complica.
