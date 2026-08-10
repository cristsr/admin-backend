---
use_case: annotate-transaction
module: transactions
trigger: rest
entrypoint: POST /transactions/{id}/annotate
command: AnnotateTransactionCommand
view: annotateTransaction
invariants: [AC-2, RNF-10, AC-2, AC-4]
introduced_by: hu-0014
last_modified_by: hu-0025
status: active
---

# Annotate Transaction

Adjunta metadatos descriptivos (payee, description, invoiceUrl, tags, metadata) a una
transacción sin tocar sus postings. Aplica a PENDING y CONFIRMED (AC-2).

**Delta hu-0025 (AC-4):** el body acepta `dryRun: boolean` (default `false`) — ejecuta el
comando completo y hace rollback, devolviendo el resultado real. Ver
[`dry-run-preview.md`](../shared/flows/dry-run-preview.md).

**Diagrama:** dynamic view `annotateTransaction` en [`../transactions.c4`](../../../apps/ledger/docs/transactions/transactions.c4).

## Reglas

- **AC-2 (hu-0014):** la anotación no cambia postings ni estado; convive con la inmutabilidad de las confirmadas.
- **AC-4 (hu-0025):** `dryRun` es metadata de transporte (va en el `AuthContext`), fuera del hash de idempotencia.

## Errores

| Condición | Excepción | HTTP |
|---|---|---|
| **NUEVO (hu-0025)** — reintentos transitorios agotados | `PersistenceConflictException` (`PERSISTENCE_CONFLICT`) | 409 |
| Transacción inexistente | `TransactionNotFoundException` (`TRANSACTION_NOT_FOUND`) | 404 |

## Respuesta

- **201:** `CommandAcceptedDto { id, streamPosition }` (o preview revertido si `dryRun: true`).
- **200:** replay idempotente (hu-0024).
