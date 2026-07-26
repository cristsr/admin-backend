# context: hu-0015

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** que las proyecciones de conciliación (`assertion_status`, `adjustment_audit`)
persistan en Postgres a través del `ReadModelStore` real, igual que el resto del núcleo
**Para** que el estado de conciliación sobreviva a un reinicio y sea reconstruible por
replay (RNF-5)

## Apps afectadas

- `apps/ledger` (mono-repo Nx; no hay microservicios separados)

Módulos tocados dentro de la app: `reconciliation` (principal), `shared-kernel`
(adaptador de checkpoints), `tooling` (registro de rebuild), `database/migrations`.

> **Estado de la rama:** `feat/core`, no `develop` (BASE_BRANCH del perfil). Hay cambios sin
> commitear en `shared-kernel/infrastructure/adapters/projection/projection-rebuilder.ts` y
> `shared-kernel/application/tooling/` (trabajo de hu-0008 en curso). Esa es justamente la
> infraestructura sobre la que esta historia construye, así que el scan se hizo sobre el
> árbol tal como está — es la base correcta.

---

## apps/ledger

### Módulo afectado

`apps/ledger/src/reconciliation/` — 70 archivos, 11 specs, 2 e2e. Compila y pasa.

### Contrato `Projector` que hay que adoptar (AC-0)

**Archivo:** `apps/ledger/src/shared-kernel/application/projection/projector.ts`

```typescript
export abstract class Projector {
  abstract readonly name: string;
  abstract readonly consumes: readonly string[];
  abstract project(event: StoredEvent, store: ReadModelStore): Promise<void>;
  handles(eventType: string): boolean { return this.consumes.includes(eventType); }
}
```

**Quién lo cumple hoy y quién no:**

| Projector | Extiende `Projector` |
|---|---|
| `AccountTreeProjector` (`accounts/infrastructure/projections/`) | Sí |
| `TransactionListProjector` (`transactions/infrastructure/projections/`) | Sí |
| `AccountBalancesProjector` (`transactions/infrastructure/projections/`) | Sí |
| `LedgerSettingsProjector` (`ledger/infrastructure/projections/`) | Sí |
| **`AssertionStatusProjector`** (`reconciliation/application/projectors/`) | **No — clase suelta** |
| **`AdjustmentAuditProjector`** (`reconciliation/application/projectors/`) | **No — clase suelta** |

Firma actual de ambos: `project(event: StoredEvent): Promise<void>` — sin `store`, sin
`name`, sin `consumes`.

### Puerto de escritura genérico

**Archivo:** `apps/ledger/src/shared-kernel/application/projection/read-model-store.ts`

```typescript
abstract upsert(table: string, key: ReadModelKey, row: ReadModelRow): Promise<void>;
abstract delete(table: string, key: ReadModelKey): Promise<void>;
abstract query<TRow>(table: string, criteria: Criteria): Promise<TRow[]>;
abstract truncate(table: string): Promise<void>;
```

**Adaptador Postgres:** `shared-kernel/infrastructure/adapters/read-model-store/postgres/postgres-read-model-store.ts`.
`upsert` genera `INSERT ... ON CONFLICT (key) DO UPDATE SET <solo las columnas provistas>`,
así que **soporta actualización parcial de fila** — que es lo que necesitan
`applyEvaluation`, `markRevoked` y `linkResolution`. La fila siempre existe antes (la creó
`BalanceAsserted`), así que el `INSERT` nunca se ejecuta con columnas faltantes.

### Puertos ricos actuales del módulo

**`AssertionStatusStore`** (`reconciliation/domain/ports/assertion-status-store.port.ts`)

Escritura: `upsertAsserted(row)`, `applyEvaluation(id, status, difference, checkedAt)`,
`markRevoked(id, reason)`, `linkResolution(id, adjustmentTxnId)`, `truncate()`
Lectura: `byId(userId, id)`, `listByAccount(userId, accountId)`,
`nonRevokedOnAccountFrom(userId, accountId, from: LedgerDate)`

**`AdjustmentAuditStore`** (`reconciliation/domain/ports/adjustment-audit-store.port.ts`)

Escritura: `record(entry)` (idempotente por `adjustmentTxnId`), `truncate()`
Lectura: `byAccount(userId, accountId)`

Implementaciones actuales: `InMemoryAssertionStatusStore`, `InMemoryAdjustmentAuditStore`
(`reconciliation/infrastructure/adapters/persistence/in-memory/`).

### Contract test reusable existente

**Archivo:** `reconciliation/domain/ports/assertion-status-store.contract.ts`
**Firma:** `runAssertionStatusStoreContract(makeStore: () => AssertionStatusStore)`, sobre
`defineContract` de `@ledger/shared/testing`. Ya se ejecuta contra el in-memory en
`in-memory-assertion-status-store.spec.ts`.

`AdjustmentAuditStore` **no tiene** contract suite — hay que crearla (AC-3).

### Tooling de rebuild

**Registro:** `shared-kernel/application/tooling/projection-registry.ts`
`register(name, projectors: readonly Projector[], tables: readonly string[])` — acepta
**varios projectors por proyección**, que es como hay que registrar las dos de conciliación
para que compartan checkpoint y orden (ver gap 3).

**Rebuilder:** `shared-kernel/infrastructure/adapters/projection/projection-rebuilder.ts`
`rebuildTarget` hace `readModel.truncate(table)` por cada tabla → las tablas deben ser
tablas reales servidas por el `ReadModelStore`, no stores bespoke.

**Entrypoint:** `apps/ledger/src/tooling/rebuild.command.ts` (targets `rebuild`,
`rebuildAll`, `verify-balances` en `project.json`). Registra hoy 4 proyecciones:
`account_tree`, `transaction_list`, `account_balances`, `ledger_settings`.

### Dispatchers disponibles

- `SynchronousProjectionDispatcher` — en la transacción del command.
- `PollingProjectionDispatcher` — lee del stream desde un checkpoint persistido y aplica
  los projectors: `pollOnce()`, `catchUp()`. Es exactamente el mecanismo que la spec §8.1
  prescribe para `assertion_status` y `adjustment_audit`.

### Migración a corregir

**Archivo:** `database/migrations/1784160000010-CreateReconciliationProjections.ts`
Crea `proj_assertions` (+2 índices), `proj_adjustment_audit`,
`proj_adjustment_audit_entries` (+1 índice), y `proj_transfer_candidates` (+2 índices).

Timestamp `1784160000010` < `1790000000001` (event store) → **corre primero, contra un
esquema que no existe**. Las tres migraciones del núcleo son `1790000000001..004`.

---

## Gaps detectados

1. **La conciliación no está cableada al runtime.** `ReevaluateAssertionsEventHandler.pump()`
   no lo llama **nadie** fuera de los tests: `grep -rn "\.pump()" src` no devuelve ningún
   call-site de producción. El handler está registrado como provider en
   `ReconciliationModule`, pero nunca se ejecuta. Consecuencia: en la app real las
   proyecciones de conciliación nunca se construyen y el reactor de re-evaluación nunca
   corre. Persistir en Postgres sin resolver esto deja tablas vacías en Postgres en vez de
   memoria vacía. **Afecta el valor de la historia: sin disparo, AC-8 (rebuild reproduce el
   estado) solo se puede verificar por el comando de rebuild, no por operación normal.**

2. **No existe adaptador Postgres de `ProjectionCheckpointRepository`.** La tabla
   `projection_checkpoints` existe (migración `1790000000002`), pero la única
   implementación es `InMemoryProjectionCheckpointRepository`. `rebuild.command.ts` la usa
   —correcto para un rebuild, que arranca de 0— pero el pump asíncrono necesita un
   checkpoint persistente o reprocesa todo el stream en cada arranque. El pump bespoke
   actual ni siquiera usa el puerto: guarda `private checkpoint = 0n` en memoria.

3. **`AdjustmentAuditProjector` lee de otra proyección.** Consulta
   `AssertionStatusStore.byId()` para obtener `difference`, `accountId` y `currencyCode` de
   la aserción resuelta. Eso acopla el orden de las dos proyecciones: si se registran como
   entradas independientes en el `ProjectionRegistry`, un `rebuild adjustment_audit`
   aislado leería un `proj_assertions` en estado arbitrario. Deben registrarse como **una
   sola proyección con dos projectors** (el registry ya lo soporta) para compartir
   checkpoint y orden.

4. **`AdjustmentAuditStore` sin contract suite** — hay que escribirla desde cero (AC-3),
   a diferencia de `AssertionStatusStore` que ya tiene la suya.

5. **Sin documentación del módulo.** No existe `apps/ledger/docs/reconciliation/`. Está
   cubierto por hu-0017, no por esta historia.

6. **`proj_transfer_candidates` quedó huérfana** en la migración tras el recorte de alcance
   (commit `934c3fa`). Cubierto por AC-5.

7. **Bug menor preexistente en `PostgresReadModelStore.buildFilterSql`**: los operadores
   `IN` y `BETWEEN` construyen los placeholders pero devuelven `value: undefined`, así que
   sus valores nunca se pushean a `params`. Cualquier query con esos operadores fallaría o
   devolvería resultados incorrectos. Fuera del alcance de esta historia, pero conviene
   registrarlo — las lecturas de conciliación no los usan hoy.
