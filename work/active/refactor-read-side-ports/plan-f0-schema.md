# refactor-read-side-ports · Fase 0: Esquema — Plan de Implementación

**Historia:** `work/active/refactor-read-side-ports/`
**App:** `apps/ledger`
**Objetivo:** Darle dueño a `proj_balances` (`user_id`) y agregar los dos índices que el
read side va a necesitar, de modo que las fases siguientes puedan resolver el scope por
usuario en el `WHERE` en vez de en memoria.
**Arquitectura:** NestJS · hexagonal · CQRS + event sourcing. Sólo se tocan la migración
de proyecciones core, el projector que escribe balances y el verificador de consistencia.
Ningún puerto todavía: esta fase prepara el terreno y deja la suite verde.
**Stack:** NestJS · TypeScript · PostgreSQL · Jest
**Prerrequisito de:** Fase 1 (sin `user_id`, `AccountBalanceFinder` no puede ser store-backed).

### Trazabilidad AC → Tareas

| AC | Cubierto por |
|----|-------------|
| AC-3 | Tarea 1 (el projector escribe `user_id`), Tarea 4 (consistency sin cruce en memoria) — se completa en Fase 1 |
| AC-10 | Tarea 5 (rebuild + consistency + e2e verdes) |

> Las demás AC pertenecen a las fases 1–5. Esta fase no introduce puertos.

---

### Tarea 0: Rama de trabajo

**Step 1: Verificar dónde estamos (read-only)**

```bash
git branch --show-current    # esperado: feat/core
git status --porcelain       # esperado: sólo work/active/refactor-read-side-ports/ y docs/proposals/
```

`BASE_BRANCH` del perfil es `develop`, pero este repo viene trabajando sobre `feat/core` y
la constitución sólo prohíbe `master`. **No se crea rama nueva**: las 6 fases van sobre
`feat/core` con un commit por fase, que es lo que las hace revisables por separado.

---

### Tarea 1: `AccountBalancesProjector` escribe `user_id` [X]

**Archivos:**
- Test: `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts`
- Modificar: `apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.ts`

**Step 1: Escribir el test que falla**

Agregar al describe existente:

```typescript
it('stamps the owning user on every balance row', async () => {
  // arrange
  const store = new InMemoryReadModelStore();
  const projector = new AccountBalancesProjector(seedCurrencyCatalog());

  // act
  await projector.project(aTransactionRecordedEvent({ userId: 'user-1' }), store);

  // assert — el dueño viaja en la fila, no se deduce cruzando proj_accounts
  const [row] = await store.query<{ user_id: string }>(PROJ_BALANCES, Criteria.none());
  expect(row.user_id).toBe('user-1');
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts --no-coverage
```

Esperado: FAIL — `expect(received).toBe('user-1')`, recibido `undefined`.

**Step 3: Implementar**

En el `upsert` del projector, agregar `user_id: event.userId` a la fila y a la clave.
El `userId` ya viaja en el `StoredEvent` (lo usa `ConsistencyVerifier.userEvents`), así que
no hace falta resolverlo contra otra proyección.

La clave del upsert pasa de `{ account_id, currency_code }` a
`{ user_id, account_id, currency_code }`, acompañando la PK de la Tarea 2.

**Step 4: Confirmar verde**

```bash
npx jest apps/ledger/src/transactions/infrastructure/projections/account-balances.projector.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 2: `proj_balances` gana `user_id` [X]

**Archivos:**
- Modificar: `apps/ledger/src/database/migrations/1790000000003-CreateCoreProjections.ts`

**Step 1: Reescribir el DDL in situ**

Fase de desarrollo sin datos en producción (CLAUDE.md): la migración se reescribe sobre
base limpia, sin backfill ni migración de datos.

```sql
CREATE TABLE "proj_balances" (
  "user_id"          UUID NOT NULL,
  "account_id"       UUID NOT NULL,
  "currency_code"    TEXT NOT NULL,
  "confirmed_amount" NUMERIC(20, 6) NOT NULL DEFAULT 0,
  "pending_amount"   NUMERIC(20, 6) NOT NULL DEFAULT 0,
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "account_id", "currency_code")
)
```

Agregar al comentario de la clase que `proj_balances` ahora carga su dueño, y por qué: sin
la columna, saber de quién es un balance obliga a cruzar contra `proj_accounts`, y ese
cruce sólo se puede hacer en memoria (INV-9, Art. 5).

**Step 2: Verificar contra base limpia**

```bash
npx jest apps/ledger/src/tooling/projection-rebuilder.integration.spec.ts --no-coverage
```

Esperado: PASS — el rebuild materializa balances con `user_id`. Si la suite de integración
requiere Postgres levantado y no lo está, dejar constancia y correrla antes de commitear.

---

### Tarea 3: Índices que el read side va a necesitar [X]

> **Corrección durante la ejecución:** el índice de `proj_pending_review` **ya existía**
> como `idx_proj_pending_review_user` sobre `("user_id", "date")`
> (`1790000000007-CreatePendingReviewProjection.ts:30-33`) — el plan asumió que faltaba.
> No se duplicó. Sólo se agregó el de `proj_postings`, con el nombre
> `idx_proj_postings_user_account` para seguir la convención de los índices vecinos.

**Archivos:**
- Modificar: `apps/ledger/src/database/migrations/1790000000007-CreatePendingReviewProjection.ts`
- Modificar: `apps/ledger/src/database/migrations/1790000000003-CreateCoreProjections.ts`

**Step 1: Agregar los dos índices**

```sql
-- en 007, junto a proj_pending_review: la bandeja se lee por usuario ordenada por fecha
CREATE INDEX "idx_proj_pending_review_user_date" ON "proj_pending_review" ("user_id", "date");

-- en 003, junto a proj_postings: el índice actual (account_id, date) no cubre el scope
-- por usuario que AssertionPostingReader va a empujar al WHERE en la Fase 5
CREATE INDEX "idx_proj_postings_user_account_date" ON "proj_postings" ("user_id", "account_id", "date");
```

**Step 2: Verificar que las migraciones corren**

```bash
npx jest apps/ledger/src/tooling/projection-rebuilder.integration.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 4: `ConsistencyVerifier` deja de cruzar en memoria [X]

**Archivos:**
- Test: `apps/ledger/src/tooling/consistency-verifier.spec.ts`
- Modificar: `apps/ledger/src/tooling/consistency-verifier.ts`

**Step 1: Escribir el test que falla**

```typescript
it('scopes stored balances by the row owner, not by the account tree', async () => {
  // arrange — un balance de otro usuario, y una fila huérfana del usuario bajo análisis
  await store.upsert(PROJ_BALANCES, keyOf('user-2', 'acc-2', 'COP'), rowOf('user-2', ...));
  await store.upsert(PROJ_BALANCES, keyOf('user-1', 'ghost', 'COP'), rowOf('user-1', ...));

  // act
  const report = await verifier.verifyBalances('user-1');

  // assert — el balance ajeno no entra; la huérfana propia sigue reportándose como drift
  expect(report.discrepancies.map((d) => d.accountId)).toEqual(['ghost']);
});
```

**Step 2: Ejecutar y confirmar que falla**

```bash
npx jest apps/ledger/src/tooling/consistency-verifier.spec.ts --no-coverage
```

Esperado: FAIL.

**Step 3: Implementar**

- `storedBalances` filtra por `Criteria.none().equals('user_id', userId)` en vez de traer
  todo y descartar con el mapa `accountOwners()`.
- `accountOwners()` se elimina: ya no hay a quién preguntarle el dueño.
- La fila huérfana **sigue reportándose**: el JSDoc actual explica que un balance sin
  cuenta es drift por definición y que ocultarlo taparía justo lo que la herramienta busca.
  Con `user_id` en la fila eso se mantiene sin esfuerzo — antes dependía de que
  `owner === undefined`.
- Actualizar el JSDoc de `storedBalances` para que describa el mecanismo nuevo.

**Step 4: Confirmar verde**

```bash
npx jest apps/ledger/src/tooling/consistency-verifier.spec.ts --no-coverage
```

Esperado: PASS.

---

### Tarea 5: Suite completa de la fase [X]

> **Verificación pendiente:** `apps/ledger` cierra en 80 suites / 484 tests verdes, pero
> las dos suites que hablan con Postgres real se auto-saltaron por no haber base levantada
> (`read-model-readers.postgres.spec.ts`, `postgres-event-store.integration.spec.ts`). El
> DDL de la Tarea 2 **no está verificado contra una base**: `projection-rebuilder.integration.spec.ts`
> pasa (5 tests) pero corre sobre `InMemoryReadModelStore`, que no valida SQL. Antes de
> commitear, levantar Postgres y correr las dos suites saltadas.

**Step 1: Correr todo lo que toca balances**

```bash
npx jest apps/ledger/src/transactions apps/ledger/src/tooling --no-coverage
```

Esperado: PASS.

**Step 2: Correr la suite del app**

```bash
npx jest apps/ledger --no-coverage
```

Esperado: PASS — sin cambios de comportamiento observable (AC-10, AC-11).

> `GetAccountBalancesHandler` sigue filtrando en memoria en esta fase: la columna existe
> pero todavía nadie la usa para consultar. Eso llega en la Fase 1, Tarea 7.

---

### Cierre de fase

```bash
git add -A && git status --porcelain    # verificar el índice antes de commitear
```

Commit sugerido: `refactor(ledger): give proj_balances an owning user`
