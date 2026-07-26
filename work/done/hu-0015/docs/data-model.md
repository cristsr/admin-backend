# data-model: hu-0015

No hay entidades TypeORM: `apps/ledger` es event-sourced y las proyecciones son tablas
planas escritas por el `ReadModelStore` con SQL generado, sin mapeo ORM. Lo que esta
historia toca es **una migración existente que hay que reemplazar** y **una tabla existente
que pasa a usarse por primera vez**.

## Migración a reemplazar

`1784160000010-CreateReconciliationProjections.ts` →
`1790000000005-CreateReconciliationProjections.ts`

Dos cambios, ningún otro:

1. **Renumeración (AC-4).** El prefijo `1784160000010` la ordena **antes** de
   `1790000000001-CreateEventStore`, así que hoy corre contra un esquema vacío. El nuevo
   prefijo `1790000000005` la ubica después de `…004-CreateLedgerSettingsProjection`, que
   es la última del núcleo. Los slots `…005` y `…006` quedaron libres al borrar las
   migraciones de EP-4 en el commit `ba18de3`.
2. **Baja de `proj_transfer_candidates` (AC-5).** La tabla y sus dos índices
   (`idx_transfer_candidates_user`, `idx_transfer_candidates_legs`) quedaron huérfanos al
   retirar RF-15 del alcance en `934c3fa`: ningún projector los escribe y ninguna query los
   lee. Se eliminan de `up()` y del `down()`.

Estamos en fase de desarrollo sin datos y sin nada deployado (CLAUDE.md), así que la
migración se reescribe en su lugar: no hace falta una migración correctiva ni pasos de
backfill.

## Tablas resultantes (sin cambios de columna)

Las tres se conservan tal cual: se verificó columna por columna contra las filas que
emiten los projectors (AC-7) y **coinciden**. Se documentan acá porque pasan a ser
escritas por el `ReadModelStore` genérico en vez de por stores bespoke.

### `proj_assertions` — proyección `assertion_status`

| Columna | Tipo | Origen |
|---|---|---|
| `assertion_id` | `uuid` PK | `event.aggregateId` |
| `user_id` | `uuid NOT NULL` | `event.userId` |
| `account_id` | `uuid NOT NULL` | payload de `BalanceAsserted` |
| `date` | `date NOT NULL` | payload de `BalanceAsserted` |
| `occurred_at` | `timestamptz` | payload de `BalanceAsserted` (nullable, §2.4) |
| `expected_amount` | `numeric(20,6) NOT NULL` | payload de `BalanceAsserted` |
| `currency_code` | `text NOT NULL` | payload de `BalanceAsserted` |
| `tolerance` | `numeric(20,6) NOT NULL DEFAULT 0` | payload de `BalanceAsserted` |
| `status` | `text NOT NULL` | `UNCHECKED` al insertar; luego `BalanceAssertionEvaluated` / `AssertionRevoked` |
| `difference` | `numeric(20,6)` | `BalanceAssertionEvaluated` |
| `resolved_by_txn` | `uuid` | `DiscrepancyResolved` |
| `revoke_reason` | `text` | `AssertionRevoked` |
| `checked_at` | `timestamptz` | `BalanceAssertionEvaluated` |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | `event.occurredAt` |

Índices:
- `idx_proj_assertions_account (user_id, account_id, date) WHERE status <> 'REVOKED'` —
  índice **parcial**, sirve exactamente a `nonRevokedOnAccountFrom`, la consulta del
  reactor.
- `idx_proj_assertions_user_status (user_id, status)`.

`status` es `TEXT`, no un enum de base de datos — los enums viven en la capa de aplicación
(Artículo 8).

### `proj_adjustment_audit` — acumulado por cuenta+moneda

PK compuesta `(user_id, account_id, currency_code)`; columnas `total_adjusted`,
`adjustment_count`, `last_adjusted_on`, `updated_at`.

**Se recalcula, no se incrementa.** El projector deriva `total_adjusted` y
`adjustment_count` agregando las filas de detalle de esa cuenta+moneda. Un
`SET total = total + x` no sería idempotente ante replay y rompería AC-8.

### `proj_adjustment_audit_entries` — detalle por ajuste

PK `adjustment_txn_id`, que es lo que da la idempotencia del flujo (RNF-4): reprocesar el
mismo `DiscrepancyResolved` reescribe la misma fila. Índice
`idx_adjustment_entries_account (user_id, account_id)`.

## Tabla existente que pasa a usarse

### `projection_checkpoints`

Creada por `1790000000002-CreateProjectionCheckpoints`, **nunca usada**: la única
implementación del puerto `ProjectionCheckpointRepository` es in-memory. Esta historia
agrega `PostgresProjectionCheckpointRepository` sobre ella, con la proyección
`reconciliation` como primer consumidor real. No requiere cambios de esquema.

## Nota sobre `TRUNCATE`

`ProjectionRebuilder` invoca `readModel.truncate(table)` por cada tabla registrada, que en
Postgres es `TRUNCATE TABLE <t> CASCADE`. Las tres tablas de conciliación no tienen claves
foráneas entre sí (deliberado, §6.3: las proyecciones no llevan constraints de negocio), así
que el `CASCADE` no arrastra nada inesperado.
