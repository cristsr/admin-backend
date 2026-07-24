# hu-0003: Agregados Account y LedgerTransaction — Plan de Implementación

**Historia:** `work/active/hu-0003/`
**Microservicio(s):** `apps/ledger`
**Objetivo:** Modelar el ciclo de vida contable completo con los agregados event-sourced `Account` y `LedgerTransaction`, probados sobre `InMemoryEventStore`.
**Arquitectura:** Agregados puros en `domain/` sin dependencias de infraestructura, factories estáticas, repositorios que extienden `EventSourcedRepository<TAggregate>`, balanceo centralizado vía `BalanceRule` (INV-11), TDD estricto.
**Stack:** NestJS · TypeScript · EventSourcing · Jest (specs unitarios + de integración)

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-1 | Tarea 1 |
| AC-2 | Tarea 2 |
| AC-3 | Tarea 2 |
| AC-4 | Tarea 2 |
| AC-5 | Tarea 3 |
| AC-6 | Tarea 3 |
| AC-7 | Tarea 3 |
| AC-8 | Tarea 4 |

---

### Tarea 0: Preparar rama de trabajo [X]

> Al ejecutar este plan, solicitar al usuario el nombre de la rama antes de continuar.

**Preguntar:** "¿Cuál es el nombre de la rama? (ej: feat/HU-0003-aggregates-o feats/HU-0003-aggregates)"

**Steps:**

**Step 1: Verificar que la base esté fresca (read-only)**

```bash
git branch --show-current
```
Esperado: `master` o la rama base del proyecto. Si no está en la base actualizada o el working tree está sucio → detener y recomendar `/sync` antes de crear la rama.

```bash
git status --porcelain
```
Esperado: vacío (working tree limpio).

**Step 2: Crear rama de trabajo**

```bash
git checkout -b <nombre-de-rama-dado-por-usuario>
```
Esperado: rama nueva creada y activa.

---

### Tarea 1: Verificar AggregateRoot base (AC-1) [X]

**Archivos:**
- Test existente: `apps/ledger/src/shared-kernel/domain/aggregate/aggregate-root.spec.ts`
- Fuente: `apps/ledger/src/shared-kernel/domain/aggregate/aggregate-root.ts`

**Step 1: Ejecutar test de AggregateRoot**

```bash
npx jest apps/ledger/src/shared-kernel/domain/aggregate/aggregate-root.spec.ts --no-coverage
```
Esperado: PASS — el test verifica que `AggregateRoot<TId>` expone `version`, `pullChanges()`, `loadFromHistory(events)`, `raise(event)` y `apply(event)`.

---

### Tarea 2: Verificar Account aggregate (AC-2, AC-3, AC-4) [X]

**Archivos:**
- Test existente: `apps/ledger/src/accounts/domain/account/account.aggregate.spec.ts`
- Fuente: `apps/ledger/src/accounts/domain/account/account.aggregate.ts`

**Step 1: Ejecutar tests unitarios de Account**

```bash
npx jest apps/ledger/src/accounts/domain/account/account.aggregate.spec.ts --no-coverage
```
Esperado: PASS.

Cobertura de ACs:
- **AC-2:** "opens a real account with exactly one currency" / "rejects a real account with more than one currency" / "allows a nominal account with several currencies"
- **AC-3:** "renames while preserving the root type" / "rejects a rename that changes the root type" / "protects system accounts from rename and close"
- **AC-4:** "closes on a date and rejects postings outside the open range" / "accepts allowed currencies and rejects others"

**Step 2: Ejecutar tests del controlador HTTP de accounts**

```bash
npx jest apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.spec.ts --no-coverage
```
Esperado: PASS — verifica que los endpoints POST /accounts, GET /accounts, GET /accounts/{id}, GET /accounts/{id}/balance, POST /accounts/{id}/rename, POST /accounts/{id}/close despachan los comandos correctos.

---

### Tarea 3: Verificar LedgerTransaction aggregate (AC-5, AC-6, AC-7) [X]

**Archivos:**
- Test existente: `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts`
- Fuente: `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.ts`

**Step 1: Ejecutar tests unitarios de LedgerTransaction**

```bash
npx jest apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts --no-coverage
```
Esperado: PASS.

Cobertura de ACs:
- **AC-5:** "records a balanced transaction" / "rejects fewer than two postings (INV-2)" / "records directly as CONFIRMED (RF-3)"
- **AC-6:** "amends while PENDING and re-balances" / "rejects amendment once CONFIRMED (INV-6)" / "annotates PENDING and CONFIRMED but not VOIDED (INV-6)"
- **AC-7:** "confirms PENDING once and rejects double confirmation" / "voids only PENDING transactions" / "reverses a CONFIRMED transaction and returns an inverted plan" / "does not reverse a PENDING transaction"

**Step 2: Ejecutar tests del controlador HTTP de transactions**

```bash
npx jest apps/ledger/src/transactions/infrastructure/adapters/http/transactions.controller.spec.ts --no-coverage
```
Esperado: PASS — verifica que los endpoints POST /transactions, GET /transactions, POST /transactions/{id}/amend, POST /transactions/{id}/annotate, POST /transactions/{id}/confirm, POST /transactions/{id}/void, POST /transactions/{id}/reverse despachan los comandos correctos.

---

### Tarea 4: Verificar rehidratación completa (AC-8) [X]

**Archivos:**
- Test existente (Account): `apps/ledger/src/accounts/domain/account/account.aggregate.spec.ts` — test "rehydrates state from history"
- Test existente (LedgerTransaction): `apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts` — test "rehydrates the full lifecycle from history"

**Step 1: Ejecutar ambos tests de rehidratación**

```bash
npx jest apps/ledger/src/accounts/domain/account/account.aggregate.spec.ts apps/ledger/src/transactions/domain/transaction/ledger-transaction.aggregate.spec.ts --no-coverage -t "rehydrat"
```
Esperado: PASS — ambos agregados reconstruyen su estado completo desde `loadFromHistory`.

---

### Tarea 5: Ejecutar suite completa del módulo ledger [X]

```bash
npx jest apps/ledger --no-coverage --passWithNoTests
```
Esperado: PASS — todos los tests del módulo ledger pasando.
