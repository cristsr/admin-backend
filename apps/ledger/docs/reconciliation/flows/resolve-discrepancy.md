---
use_case: resolve-discrepancy
module: reconciliation
trigger: rest
entrypoint: POST /v1/balance-assertions/{id}/resolve
command: ResolveDiscrepancyCommand
view: resolveDiscrepancy
invariants: [RF-20, INV-1, INV-10, Artículo 2, Artículo 12]
introduced_by: hu-0017
last_modified_by: hu-0017
status: active
---

# Resolver una discrepancia con un ajuste

Cuando la diferencia es real —el dinero efectivamente no está donde el ledger dice— se cierra
registrando un **ajuste contable**: una `LedgerTransaction` de origen sistema contra
`Equity:Adjustments`, por el monto exacto de la diferencia.

No es un parche sobre el saldo. Es partida doble como cualquier otra transacción, y por eso
el handler despacha `RecordTransaction` por el `CommandBus` en vez de escribir la proyección
(Artículo 10). El dinero sin explicación queda acumulado y visible por cuenta en
`adjustment_audit`, no escondido en un cuadre.

**Diagrama:** dynamic view `resolveDiscrepancy` en [`../reconciliation.c4`](../reconciliation.c4).

## Reglas

- **RF-20:** el ajuste se registra contra `Equity:Adjustments`, la cuenta técnica creada al
  inicializar el ledger, que no puede cerrarse.
- **Solo sobre una discrepancia real:** la aserción debe estar `MISMATCHED` con `difference`
  conocida. Resolver una `MATCHED`, una `UNCHECKED` o una `INDETERMINATE` se rechaza.
- **INV-1 / Artículos 2 y 12:** el ajuste balancea a cero por moneda como toda transacción, y
  lo verifica el agregado antes de emitir nada — la regla de balanceo no se duplica acá.
- La aserción queda vinculada a su ajuste por `resolvedByTxn`: eso es lo que hace auditable
  la cadena discrepancia → ajuste.

**Atomicidad (hu-0023):** el `TransactionRecorded` del ajuste y el `DiscrepancyResolved`
van a streams distintos, así que ambos appends corren dentro de
`EventStore.withTransaction`. Una aserción marcada como resuelta sin su ajuste afirmaría
que el dinero está explicado cuando no lo está; con la transacción, o se aplican los dos o
ninguno.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| La aserción no existe para este usuario | `AssertionNotFoundException` | 404 |
| No hay discrepancia que resolver | `DiscrepancyNotResolvableException` | 422 |
| El ledger no está inicializado | `LedgerNotInitializedException` | 422 |
| Sin contexto autenticado | — (guard, RF-26) | 401 |

## Respuesta

`200 OK` con `ResolveDiscrepancyResponse`, que incluye el `adjustmentTransactionId` — el id
de la transacción de ajuste recién creada, para que el cliente pueda mostrarla.
