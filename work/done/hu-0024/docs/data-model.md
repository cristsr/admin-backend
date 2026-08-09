# data-model: hu-0024 — columnas de integridad en `event_store`

No hay tabla nueva. Se agregan **dos columnas y un CHECK** a `event_store`, reescribiendo la
migración de creación en vez de agregar una incremental.

## Por qué se reescribe la migración de creación

`CLAUDE.md` declara fase de desarrollo sin datos en producción: el esquema puede reordenarse
sobre una base limpia, sin pasos de data-migration ni backfill. Eso es lo que permite que `hash`
sea `NOT NULL` desde el día uno (AC-8) y que no exista ninguna rama de tolerancia a eventos sin
hash en `verify-chain` ni en la comparación de idempotencia.

**Archivo a editar:**
`libs/cqrs/src/infrastructure/adapters/migrations/1790000000001-CreateEventStore.ts` — no se
crea una migración nueva. La base se regenera.

## DDL resultante

```sql
CREATE TABLE "event_store" (
  "global_position"   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_id"          UUID NOT NULL UNIQUE,
  "user_id"           UUID NOT NULL,
  "aggregate_type"    TEXT NOT NULL,
  "aggregate_id"      UUID NOT NULL,
  "sequence"          BIGINT NOT NULL,
  "event_type"        TEXT NOT NULL,
  "schema_version"    SMALLINT NOT NULL DEFAULT 1,
  "client_id"         TEXT NOT NULL,
  "external_ref"      TEXT,
  "external_ref_hash" CHAR(64),                      -- NUEVA (AC-5)
  "payload"           JSONB NOT NULL,
  "hash"              CHAR(64) NOT NULL,             -- NUEVA (AC-2, AC-8)
  "occurred_at"       TIMESTAMPTZ NOT NULL,
  "recorded_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_event_aggregate_sequence" UNIQUE ("aggregate_id", "sequence"),
  CONSTRAINT "ck_event_external_ref_hash"            -- NUEVO (AC-8)
    CHECK (("external_ref" IS NULL) = ("external_ref_hash" IS NULL))
);
```

Índices y trigger: **sin cambios**. Los cuatro existentes se conservan tal cual.

## Detalle de cada elemento nuevo

| Elemento | Tipo | Nulabilidad | AC | Razón |
|---|---|---|---|---|
| `hash` | `CHAR(64)` | `NOT NULL` | AC-2, AC-8 | Hash de la cadena, hex minúscula. Todo evento está encadenado; un evento sin hash es irrepresentable. |
| `external_ref_hash` | `CHAR(64)` | `NULL` | AC-5, AC-8 | Hash canónico de los inputs del command. Solo el evento **ancla** lo lleva, igual que `external_ref` (`EnvelopeFactory` estampa ambos con `index === 0`). |
| `ck_event_external_ref_hash` | CHECK | — | AC-8 | Fuerza que los dos campos de idempotencia aparezcan y falten juntos. Vuelve irrepresentable el estado que obligaría a una rama de "hash ausente". |

### Por qué `CHAR(64)` y no `bytea`

Texto hexadecimal en minúscula: legible tal cual en `\d`, en logs y en el reporte de
`verify-chain`, sin `encode()`. El ahorro de 32 bytes por fila de `bytea` no compensa la
fricción de depuración en un ledger personal.

### Por qué `external_ref_hash` no puede ser `NOT NULL`

Solo tiene sentido cuando el command trae `external_ref`, que es opcional (§2.10: sin registro
de clientes no se exige por `client_id`). Usar `''` como centinela mezclaría "no aplica" con
"vacío" en el mismo valor y obligaría a recordar la convención en cada consulta; el CHECK
expresa la regla real sin ese costo.

### Por qué no hay índice sobre `hash`

Ninguna consulta filtra por hash. `verify-chain` recorre en orden de `global_position` y el
append lee la cabeza del usuario — los dos casos ya los sirve `idx_event_user (user_id,
global_position)`, que existe desde la migración original.

## Impacto en el código de persistencia

| Archivo | Cambio |
|---|---|
| `libs/cqrs/.../postgres/postgres-event-store.ts` | `SELECT_COLUMNS` suma `external_ref_hash` (no `hash`: no sube al dominio). `insertAll` pasa de 12 a 14 parámetros por fila — el `Array.from({ length: 12 })` y el `idx += 12` están acoplados al conteo y hay que tocarlos juntos. |
| `libs/cqrs/.../postgres/event-store.row.type.ts` | `EventStoreRow` suma `external_ref_hash: string \| null`; `toStoredEvent` lo mapea a `externalRefHash`. |
| `libs/cqrs/.../postgres/postgres-event-chain-reader.ts` | **Nuevo.** Lee `global_position, event_id, hash` + las columnas del hash input, ordenado por `global_position`. |
| `apps/ledger/.../postgres-event-store.integration.spec.ts` | El `INSERT` **crudo** del test del trigger append-only omite columnas y **deja de funcionar** con `hash NOT NULL`: hay que agregarle el valor. |

## Riesgo de migración

Ninguno en datos (no hay). El riesgo real es operativo: **quien tenga una base local viva
tiene que recrearla** — `npm run migration:revert:ledger` no alcanza, porque la migración se
edita en lugar de agregarse. `/plan` debe incluir la tarea de regenerar la base antes de correr
los tests de integración.
