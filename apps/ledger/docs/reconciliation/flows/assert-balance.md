---
use_case: assert-balance
module: reconciliation
trigger: rest
entrypoint: POST /v1/balance-assertions
command: AssertBalanceCommand
view: assertBalance
invariants: [RF-17, INV-10, RNF-9, Artículo 5]
introduced_by: hu-0017
last_modified_by: hu-0017
status: active
---

# Afirmar un saldo

El usuario declara cuánto debería haber en una cuenta a una fecha, tomando el dato de su
extracto bancario. La aserción se registra como evento; **el veredicto no viaja en la
respuesta**: evaluar es asíncrono y se consulta después con `getAssertionStatus`.

El corte puede ser el cierre del día (sin `occurredAt`) o un instante intradía (con él). Esa
distinción gobierna toda la semántica temporal de §2.4 y no se puede cambiar después: una
aserción es inmutable — se revoca y se rehace.

**Diagrama:** dynamic view `assertBalance` en [`../reconciliation.c4`](../reconciliation.c4).

## Reglas

- **RF-17:** la aserción es sobre **exactamente** esa cuenta, nunca su subárbol. Es la regla
  de Beancount y la correcta para conciliar contra un extracto con espejo 1:1 (§2.1).
- **Moneda:** debe coincidir con la de la cuenta — una cuenta real opera en una sola moneda.
- **Tolerancia:** por defecto `0`, coincidencia exacta. El extracto bancario es exacto por
  definición (§2.7.1), así que tolerar diferencias es la excepción, no la norma.
- **Idempotencia (INV-10):** el `X-External-Ref` hace que un reintento no cree una segunda
  aserción.
- **Aislamiento (Artículo 5):** la cuenta debe pertenecer al usuario del contexto.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| La moneda no coincide con la cuenta | `AssertionCurrencyMismatchException` | 422 |
| El ledger no está inicializado | `LedgerNotInitializedException` | 422 |
| Sin contexto autenticado | — (guard, RF-26) | 401 |

## Respuesta

`201 Created` con `AssertBalanceResponse` (`assertionId`, `streamPosition`) y el header
`X-Ledger-Stream-Position`, que permite al cliente leer su propia escritura (RNF-9).
