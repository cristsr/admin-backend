---
use_case: project-transaction-list
module: transactions
trigger: domain-event
entrypoint: SynchronousProjectionDispatcher.dispatch(StoredEvent)
command: N/A (projector reactivo)
view: projectTransactionList
invariants: [AC-1, AC-2, AC-4, INV-5, RNF-5]
introduced_by: hu-0006
last_modified_by: hu-0006
status: active
---

# Proyectar transaction_list

El `TransactionListProjector` mantiene dos tablas del read model: `proj_transactions`
(una fila desnormalizada por transacción) y `proj_postings` (una fila por línea de
asiento). Reacciona a cinco eventos del ciclo de vida de `LedgerTransaction` y deriva
`derived_kind` desde `account_tree` usando `TransactionKindDeriver`.

**Diagrama:** dynamic view `projectTransactionList` en [`../model.delta.c4`](../model.delta.c4).

## Reglas

- **AC-1:** Cada evento (`TransactionRecorded`, `Amended`, `Annotated`, `Confirmed`,
  `Voided`) actualiza `proj_transactions` y `proj_postings` al estado exacto del último
  evento aplicado. El estado de los postings siempre coincide con el de la transacción.
- **AC-2:** `derived_kind` se calcula obteniendo los tipos de cuenta de los postings desde
  `proj_accounts` y delegando a `TransactionKindDeriver.derive(types)`. Si una cuenta no
  aparece en `account_tree` (desfase temporal), el resultado es `COMPOUND` — nunca lanza
  excepción ni bloquea el dispatch.
- **AC-4 / RNF-5:** La idempotencia por clave del `upsert` garantiza que proyectar el mismo
  stream dos veces da el mismo estado final.
- **INV-5:** Solo este proyector y `AccountBalancesProjector` escriben `proj_postings`;
  ningún command handler escribe directamente en los read models.
- **DerivedKind logic (RF-4):** Solo EXPENSES → `EXPENSE`; solo INCOME → `INCOME`; solo
  ASSETS/LIABILITIES → `TRANSFER`; cualquier otra combinación → `COMPOUND`.

## Errores

| Condición | Excepción | Efecto |
|---|---|---|
| Cuenta no encontrada en `account_tree` | Ninguna | `derived_kind` cae en `COMPOUND` — se reconcilia en rebuild |
| Transacción no encontrada en `onAmended`/`onAnnotated`/`onStatus` | Ninguna | Retorna sin efecto (proyección eventual consistente) |

## Respuesta

Sin respuesta directa (proyector reactivo). El efecto observable es el estado actualizado en:
- `proj_transactions`: transacción con status, derived_kind, payee, fecha y metadatos.
- `proj_postings`: una fila por posting (id compuesto `{transaction_id}#{index}`).
