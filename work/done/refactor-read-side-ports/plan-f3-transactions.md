# refactor-read-side-ports · Fase 3: `transactions` — Plan de Implementación

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Objetivo:** Servir la lista de transacciones, el detalle y la bandeja de revisión por
puertos tipados, resolviendo en SQL el filtro por cuenta que hoy se arma en memoria.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. `PendingReviewFinder` es
store-backed; `TransactionFinder` es **el único puerto de toda la refactorización con
adapter SQL** (R7), porque el filtro por cuenta necesita un `EXISTS` sobre `proj_postings`
y el detalle se resuelve mejor en una sola consulta. Por eso lleva gemelo in-memory y
contract test compartido — Integration-First Gate.
**Stack:** NestJS · TypeScript · TypeORM (`DataSource`) · PostgreSQL · Jest

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 8 |
| AC-4 | Tarea 1 (`transaction-list.schema.ts` con las 10 columnas reales de `proj_postings`) |
| AC-5 | Tarea 2, Tarea 8 |
| AC-6 | Tareas 3 y 5 (`Finder`, sirven a la API) |
| AC-9 | Tarea 5 (gemelo in-memory), Tarea 4 (contract test contra ambos), Tarea 9 |
| AC-11 | Tarea 9 (`transactions-api.e2e.spec.ts` sin tocar expectativas) |

---

### Tarea 0: Rama de trabajo [X]

Se continúa en `feat/core`. Working tree limpio.

---

### Tarea 1: Esquemas de `proj_transactions`, `proj_postings` y `proj_pending_review` [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/infrastructure/projections/transaction-list.schema.ts`
- Crear: `apps/ledger/src/transactions/infrastructure/projections/pending-review.schema.ts`
- Modificar: los tres projectors del módulo

**Step 1: Declarar `PostingRow` completo — AC-4**

El punto crítico de la tarea. Hoy hay dos `PostingRow` distintos y ninguno describe la
tabla: el de `application` tiene 6 campos y el de
`read-model-assertion-posting-reader.ts:16` tiene 7. El DDL tiene 10 columnas:

```typescript
export type PostingRow = {
  readonly posting_id: string;
  readonly transaction_id: string;
  readonly user_id: string;
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly status: string;
  readonly date: string;
  /** Denormalized from the transaction; null when the instant is unknown. */
  readonly occurred_at: Nullable<string>;
  readonly metadata: Readonly<Record<string, string>>;
};
```

`read-model-assertion-posting-reader.ts` pasa a importar de acá y borra su declaración local.

`TransactionRow` (14 columnas) y `PendingReviewRow` (9) se mueven tal cual, con sus
`to*View`.

**Step 2: Confirmar projectors verdes**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections --no-coverage
```

Esperado: PASS.

---

### Tarea 2: `View`s a `application/views/` [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/application/views/transaction.view.ts` (`PostingView`, `TransactionListItemView`, `TransactionView`)
- Crear: `apps/ledger/src/transactions/application/views/pending-review.view.ts`

Conservar los JSDoc que explican **por qué** la lista no trae postings ("la proyección no
está formada para eso; el detalle es donde corresponden") y por qué los montos viajan como
string decimal exacto (INV-8, Art. 7).

---

### Tarea 3: `PendingReviewFinder` + adapter [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/application/ports/pending-review-finder.port.ts`
- Crear: `apps/ledger/src/transactions/infrastructure/adapters/persistence/read-model-pending-review-finder.ts`
- Test: `…/read-model-pending-review-finder.spec.ts`

**Step 1: Escribir el test que falla**

```typescript
it('serves the inbox oldest first', async () => { /* orden ASC, a diferencia de la lista */ });
it('scopes the inbox to the user', async () => { /* INV-9 */ });
it('paginates with the default page size when none is given', async () => { /* … */ });
```

**Step 2–4: Implementar**

```typescript
export abstract class PendingReviewFinder {
  abstract list(userId: string, page: PageRequest): Promise<readonly PendingReviewView[]>;
}
```

Conservar en el JSDoc la razón del orden ascendente: la bandeja es una cola de trabajo, lo
que más esperó sale primero — al revés que la lista de transacciones, que se lee como
historia.

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/persistence/read-model-pending-review-finder.spec.ts --no-coverage
```

Esperado: PASS. Migrar `ListPendingReviewHandler` en el mismo ciclo.

---

### Tarea 4: Contract test de `TransactionFinder` — Integration-First [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/infrastructure/testing/transaction-finder.contract.ts`

**Step 1: Escribir el contrato antes que cualquier adapter**

Sigue la forma de `assertion-status-store.contract.ts` (`defineContract`), y se ejecutará
contra los **dos** adapters de la Tarea 5.

Casos que el contrato debe fijar:

```typescript
// list
'scopes the page to the user'                      // INV-9
'orders by date, newest first'
'filters by status, derived kind, payee (case-insensitive), client and date range'
'narrows by account BEFORE paginating'             // el bug que motiva el adapter SQL
'returns a total that describes the same filters as the page'
'returns an empty page when the account has no postings'
// byId
'returns the transaction with its postings'
'returns null for a transaction of another user'   // INV-9
'never leaks the postings of another user transaction'
```

El caso `narrows by account BEFORE paginating` es el que documenta el defecto actual: hoy
`list-transactions.handler.ts:63` trae todos los ids de posting de la cuenta y los mete como
`IN (...)`, lo que funciona pero no acota; el contrato exige el resultado correcto sin
prescribir cómo.

**Step 2: Verificar que el contrato no compila todavía**

```bash
npx tsc --noEmit -p apps/ledger/tsconfig.app.json
```

Esperado: FAIL — el puerto no existe.

---

### Tarea 5: `TransactionFinder` + los dos adapters [X]

**Archivos:**
- Crear: `apps/ledger/src/transactions/application/ports/transaction-finder.port.ts`
- Crear: `apps/ledger/src/transactions/infrastructure/adapters/persistence/postgres-transaction-finder.ts`
- Crear: `apps/ledger/src/transactions/infrastructure/adapters/persistence/read-model-transaction-finder.ts`
- Test: `…/transaction-finder.postgres.spec.ts` y `…/transaction-finder.in-memory.spec.ts` (ambos ejecutan el contrato de la Tarea 4)

**Step 1: Definir el puerto**

```typescript
export type TransactionFilter = {
  readonly status: Nullable<string>;
  readonly derivedKind: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly clientId: Nullable<string>;
  readonly accountId: Nullable<string>;
  readonly fromDate: Nullable<string>;
  readonly toDate: Nullable<string>;
};

export abstract class TransactionFinder {
  abstract list(
    userId: string,
    filter: TransactionFilter,
    page: PageRequest,
  ): Promise<TransactionPage>;

  abstract byId(userId: string, transactionId: string): Promise<Nullable<TransactionView>>;
}
```

**Step 2: Ejecutar el contrato y confirmar que falla**

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/persistence --no-coverage
```

Esperado: FAIL en ambos specs.

**Step 3: Implementar `PostgresTransactionFinder`**

Sobre `DataSource`. El filtro por cuenta pasa a subconsulta:

```sql
AND EXISTS (SELECT 1 FROM proj_postings p WHERE p.transaction_id = t.transaction_id AND p.account_id = $n)
```

`byId` resuelve transacción y legs con `user_id` en el `WHERE` de ambas. Conservar la
garantía que hoy documenta `get-transaction-by-id.handler.ts`: las legs no se pueden
devolver antes de comprobar el scope, porque `proj_postings` está indexado por transacción y
consultarlo primero respondería antes de verificar el dueño.

Parámetros siempre ligados (`$1`, `$2`, …), nunca interpolados — igual que
`PostgresReadModelStore`.

**Step 4: Implementar `ReadModelTransactionFinder` (gemelo)**

Sobre `ReadModelStore`, para las composiciones in-memory (AC-9). Puede resolver el filtro
por cuenta en dos pasos como hoy: es correcto sobre un store en memoria y el contrato lo
verifica igual.

**Step 5: Confirmar verde**

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/persistence --no-coverage
```

Esperado: PASS — el mismo contrato verde contra los dos adaptadores.

---

### Tarea 6: Migrar `ListTransactions` y `GetTransactionById` [X]

**Archivos:**
- Modificar: los dos handlers y sus specs

Ambos quedan en una delegación al puerto. `ListTransactionsHandler` pierde
`transactionIdsForAccount()`; `GetTransactionByIdHandler` pierde la segunda consulta. La
resolución de `limit`/`offset` por defecto se queda en el handler (es política del caso de
uso, no de la persistencia).

```bash
npx jest apps/ledger/src/transactions/application/usecases --no-coverage
```

Esperado: PASS.

---

### Tarea 7: Wiring [X]

**Archivos:**
- Modificar: `transactions.module.ts` (2 bindings), `read-side-ports.factory.ts`, `query-bus.factory.ts`

`withSqlTransactionFinder(base, dataSource)` sustituye el gemelo por el adapter SQL en la
composición real. `TransactionsModule` bindea `TransactionFinder` a
`PostgresTransactionFinder`; las composiciones de test usan `createQueryPorts` a secas.

```bash
npx jest apps/ledger/src/app.wiring.spec.ts apps/ledger/src/bootstrap --no-coverage
```

Esperado: PASS.

---

### Tarea 8: Borrar lo viejo — AC-1, AC-5 [X]

- Borrar: `apps/ledger/src/transactions/application/read-models/` completo (3 archivos + specs).
- Verificar:

```bash
grep -rn "read-model-store\|Criteria" apps/ledger/src/transactions/application/
```

Esperado: sin resultados.

---

### Tarea 9: Suite completa — AC-9, AC-11 [X]

```bash
npx jest apps/ledger --no-coverage
```

Esperado: PASS. Atención a `transactions-api.e2e.spec.ts` y
`transactions.merge-transfers.e2e.spec.ts`, que corren sobre la composición in-memory y por
lo tanto sobre el gemelo.

---

### Cierre de fase

Commit sugerido: `refactor(ledger): read transactions through a typed finder`
