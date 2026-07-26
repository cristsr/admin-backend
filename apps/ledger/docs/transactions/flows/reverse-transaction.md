---
use_case: reverse-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/reverse
command: ReverseConfirmedTransactionCommand
view: reverseTransaction
invariants: [AC-2, RNF-10]
introduced_by: hu-0014
last_modified_by: hu-0014
status: active
---

# Reversar transacción confirmada

Anula el efecto contable de una transacción ya `CONFIRMED` **sin mutarla**: crea una
transacción de reversa (T2) con los postings invertidos y `metadata.reverses_id = {id}`
apuntando a la original (§7.3). El stream permanece inmutable — la original queda tal cual
en su historia.

Es el único endpoint del ciclo de vida que responde **`201`**, porque crea un agregado
nuevo. **Devuelve el id de la reversa (T2), no el de la original** — un detalle fácil de
pasar por alto al integrar.

**El `reason?` del body se ignora.** El controller declara `_dto:
ReverseTransactionRequestDto` y despacha `new ReverseConfirmedTransactionCommand(id)`: a
diferencia de `void`, el motivo no se persiste. El campo sigue en el DTO y en el contrato
para no romper clientes, pero no tiene efecto.

**Diagrama:** dynamic view `reverseTransaction` en [`../transactions.c4`](../transactions.c4).

## Reglas

- **AC-2:** responde `201 CommandAcceptedDto` cuyo `id` es el de la transacción de reversa.
- Solo en `CONFIRMED`. Una `PENDING` se anula con `void`, no se reversa.
- La reversa nace `CONFIRMED`: su efecto sobre los saldos es inmediato y opuesto al de la
  original.
- **Idempotencia:** ver [`../../shared/flows/idempotent-write.md`](../../shared/flows/idempotent-write.md).

## Errores

| Condición | Excepción | code | HTTP |
|---|---|---|---|
| Transacción inexistente para el usuario | `TransactionNotFoundException` | `TRANSACTION_NOT_FOUND` | 404 |
| La transacción no está `CONFIRMED` | `InvalidTransactionStateException` | `INVALID_TRANSACTION_STATE` | 409 |

## Respuesta

`201`: `CommandAcceptedDto { id, streamPosition }` + header `X-Ledger-Stream-Position`,
donde `id` es **la transacción de reversa (T2)**.
