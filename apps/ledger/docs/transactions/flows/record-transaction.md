---
use_case: record-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions
command: RecordTransactionCommand
invariants: [INV-1, INV-2, INV-11]
introduced_by: hu-0003
last_modified_by: spec-0033
status: active
---

# Registrar transacción

Crea un asiento contable (PENDING o CONFIRMED). El `RecordTransactionHandler` arma los
`PostingLine` con la `PostingFactory` y construye el agregado vía `LedgerTransaction.record(...)`,
que exige el balanceo a cero por moneda antes de emitir `TransactionRecorded`.

```mermaid
sequenceDiagram
  actor Client
  participant C as TransactionsController
  participant CB as CommandBus
  participant H as RecordTransactionHandler
  participant PF as toPostingLines
  participant T as LedgerTransaction
  participant BR as BalanceRule
  participant R as LedgerTransactionRepository
  participant ES as EventStore

  Client->>C: POST /transactions (RecordTransactionRequestDto)
  C->>CB: dispatch(RecordTransactionCommand)
  CB->>H: handle
  H->>PF: build(postings)
  H->>T: record(...) — INV-2
  T->>BR: ensureBalanced() — INV-1 / INV-11
  T->>T: raise(TransactionRecorded)
  H->>R: save(tx)
  R->>ES: append(TransactionRecorded)
```

## Reglas

- **INV-2:** al menos 2 postings.
- **INV-1 / INV-11:** la suma por moneda debe ser cero (`ZeroSumBalanceRule`).
- **INV-8:** montos como string decimal exacto.
- `status` de creación: PENDING o CONFIRMED (nunca VOIDED).

## Errores

| Condición | HTTP |
|---|---|
| Menos de 2 postings (INV-2) o desbalance (INV-1) | 422 |

## Respuesta

`201 Created` con `CommandAccepted` (`id`, `streamPosition`).

## Efectos posteriores (asíncronos)

Al persistirse `TransactionRecorded`, el `TransferCandidatesProjector` evalúa el evento
para la detección de transferencias — ver [detect-transfer](./detect-transfer.md).
