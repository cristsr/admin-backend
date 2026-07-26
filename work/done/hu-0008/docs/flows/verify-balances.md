---
use_case: verify-balances
module: shared-kernel
trigger: cli
entrypoint: nx run ledger:verify-balances --userId <uuid>
command: ConsistencyVerifier.verifyBalances(userId)
view: shared_kernel_verify_balances
invariants: [AC-5, AC-6, INV-8, INV-12]
introduced_by: hu-0008
last_modified_by: hu-0008
status: active
---

# Verify balances stream vs projection

Lee el stream de eventos para un usuario específico, recalcula los saldos de
cada cuenta y moneda directamente desde los eventos (sin usar las proyecciones
intermedias `proj_postings`), y compara con exactitud decimal los resultados
contra `proj_balances`. Si una fila de `proj_balances` se corrompe, el
verificador detecta y reporta la diferencia exacta.

**Diagrama:** dynamic view `shared_kernel_verify_balances` en
[`../shared-kernel.c4`](../../../apps/ledger/docs/shared-kernel/shared-kernel.c4).

## Reglas

- **AC-5:** Recalcula saldos leyendo `EventStore.readAll()`, deserializando
  eventos vía `EventRegistry`, y acumulando montos por `(accountId, currencyCode,
  status)` usando `Money` (aritmética exacta). Luego consulta `proj_balances` vía
  `ReadModelStore.query()` y compara cada fila con `Money.equals()`. Si hay
  diferencia, reporta la cuenta, moneda y drift exacto.
- **AC-6:** Solo lee del EventStore (`readAll`), nunca invoca `append`.
- **INV-8:** Comparación decimal exacta con `Money.equals()` — nunca tolerancia
  numérica ni redondeo. Los montos se construyen desde strings decimales
  (`Money.of()`).
- **INV-12:** El stream es append-only; el verifier solo lo consulta.

## Errores

| Condición | Excepción | Comportamiento |
|---|---|---|
| `userId` inválido (no UUID) | Error de validación | El CLI aborta con mensaje descriptivo |
| El stream no tiene eventos para ese `userId` | — | `verifyBalances` retorna `{ ok: true }` (sin eventos = consistencia trivial) |
| `proj_balances` tiene una fila que no aparece en el cómputo del stream | Drift detectado | Reporta `{ ok: false, discrepancies: [...] }` con la fila espuria |
| El cómputo del stream produce una fila que no está en `proj_balances` | Drift detectado | Reporta `{ ok: false, discrepancies: [...] }` con la fila faltante |
| Deserialización de evento falla (`UnknownEventTypeException`) | Error de `EventRegistry` | Se propaga; el CLI muestra el error |

## Respuesta

- **OK:** el CLI imprime "Consistencia verificada: proj_balances coincide con el
  stream para el usuario <userId>."
- **DRIFT:** el CLI imprime una tabla con cada discrepancia: accountId,
  currencyCode, saldo según stream, saldo según proj_balances, drift.
