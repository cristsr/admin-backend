# context: hu-0024 — Integridad verificable del event store

## Historia resumida

**Como** responsable de la integridad contable del ledger
**Quiero** que el event store sea criptográficamente verificable y que la idempotencia detecte
reusos de referencia con datos distintos
**Para** que ninguna alteración del stream pase inadvertida y ningún comando se pierda en
silencio

## Apps / libs afectadas

- **`libs/cqrs`** — event store (puerto + 2 adaptadores), contract test, `IdempotencyPolicy`,
  `CommandResult`, interceptor HTTP, migración `CreateEventStore`
- **`apps/ledger`** — tooling (`verify-chain`), registro de códigos de error, spec de
  integración contra Postgres real, targets de `project.json`
- **`libs/shared`** — destino candidato de la función de canonicalización JCS

> **Estado de git:** rama `feat/core` (no es la base `master`), con cambios sin commitear
> preexistentes en `apps/ledger/.../account-tree.schema.ts`, `libs/cqrs/.../synchronous-dispatcher.ts`
> y varios docs. Sin upstream configurado. El scan leyó el árbol tal como está.

---

## 1. El event store hoy

### Puerto (dominio)

**`libs/cqrs/src/domain/ports/event-store.ts`** — `abstract class EventStore`:

```typescript
append(stream: StreamId, expectedVersion: number, events: readonly EventEnvelope[]): Promise<AppendResult>
load(stream: StreamId): Promise<readonly StoredEvent[]>
readAll(fromPosition: bigint, limit: number): Promise<readonly StoredEvent[]>
withTransaction<T>(work: () => Promise<T>): Promise<T>
findByExternalRef(userId: string, externalRef: string): Promise<Nullable<StoredEvent>>
```

### Tipos del stream

**`libs/cqrs/src/domain/event/event-envelope.type.ts`** — `EventEnvelope` (12 campos, todos
`readonly`): `eventId`, `userId`, `aggregateType`, `aggregateId`, `sequence`, `eventType`,
`schemaVersion`, `clientId`, `externalRef` (`Nullable<string>`), `payload`, `occurredAt`,
`recordedAt`.

- `stored-event.type.ts` — `StoredEvent = EventEnvelope & { globalPosition: bigint }`
- `append-result.type.ts` — `{ events, version, lastPosition }`
- `stream-id.type.ts` — `{ userId, aggregateType, aggregateId }`
- `event-payload.type.ts` — `Readonly<Record<string, unknown>>`, montos como string decimal (INV-8)

**Correspondencia AC-3:** los 10 campos del envelope que la HU manda hashear son exactamente los
12 menos `recordedAt` (excluido) — `globalPosition` no está en `EventEnvelope`, solo en
`StoredEvent`. La exclusión cae natural sobre los tipos existentes.

### Esquema físico vigente

**`libs/cqrs/src/infrastructure/adapters/migrations/1790000000001-CreateEventStore.ts`**

```sql
CREATE TABLE "event_store" (
  "global_position" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_id"        UUID NOT NULL UNIQUE,
  "user_id"         UUID NOT NULL,
  "aggregate_type"  TEXT NOT NULL,
  "aggregate_id"    UUID NOT NULL,
  "sequence"        BIGINT NOT NULL,
  "event_type"      TEXT NOT NULL,
  "schema_version"  SMALLINT NOT NULL DEFAULT 1,
  "client_id"       TEXT NOT NULL,
  "external_ref"    TEXT,
  "payload"         JSONB NOT NULL,
  "occurred_at"     TIMESTAMPTZ NOT NULL,
  "recorded_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_event_aggregate_sequence" UNIQUE ("aggregate_id", "sequence")
)
```

Índices y trigger existentes:
- `idx_event_external_ref` — UNIQUE parcial `(user_id, external_ref) WHERE external_ref IS NOT NULL`
- `idx_event_aggregate` — `(aggregate_id, sequence)`
- **`idx_event_user` — `(user_id, global_position)`** ← ya es exactamente el índice que
  `verify-chain` (AC-4) y la búsqueda del "último evento del usuario" (AC-2) necesitan
- `trg_event_store_immutable` — trigger `BEFORE UPDATE OR DELETE` que lanza `event_store is append-only`

**La migración se reescribe in situ** (decisión de AC-8): agregar `hash char(64) NOT NULL`,
`external_ref_hash char(64) NULL` y el CHECK `(external_ref IS NULL) = (external_ref_hash IS NULL)`.

### Adaptador Postgres

**`libs/cqrs/src/infrastructure/adapters/event-store/postgres/postgres-event-store.ts`**

- `SELECT_COLUMNS` — const con las 13 columnas, compartida por `load`/`readAll`/`findByExternalRef`.
  **Un solo punto a tocar** para exponer las columnas nuevas.
- `insertAll(manager, events)` — INSERT multi-fila. Arma placeholders con
  `Array.from({ length: 12 }, (_, i) => '$' + (idx + i))` y `idx += 12`, con el `push` de 12
  parámetros en orden posicional. **El `12` está hardcodeado en tres lugares acoplados**
  (deuda registrada en la HU).
- `withTransaction` — usa `AsyncLocalStorage<EntityManager>`; un `append` dentro del scope se
  suma a la transacción abierta, fuera abre la suya.
- `translate(error)` — mapea `23505` + nombre de constraint a `DuplicateExternalRefException`
  (`idx_event_external_ref`) o `ConcurrencyConflictException` (`uq_event_aggregate_sequence`).

**`.../postgres/event-store.row.type.ts`** — `EventStoreRow` (snake_case, bigints como texto) +
`toStoredEvent(row)`. Segundo punto a tocar si las columnas nuevas suben al tipo de dominio.

### Adaptador in-memory

**`libs/cqrs/src/infrastructure/adapters/event-store/in-memory/in-memory-event-store.ts`** —
implementación de referencia con un contador `nextPosition`, rollback por snapshot en
`withTransaction`, y validaciones propias (`ensureConsecutiveSequences`,
`ensureExternalRefsAreFresh`). **Debe encadenar igual que Postgres** para seguir pasando el
contract test compartido.

---

## 2. El contract test compartido (el corazón del testing)

**`libs/cqrs/src/infrastructure/testing/event-store.contract.ts`** — `describeEventStoreContract(makeStore, teardown?)`,
17 casos. Helpers reutilizables: `anEnvelope(stream, overrides)`, `streamFor(userLabel, aggregateLabel)`,
`uuidFor(label)` (mapea etiquetas legibles a UUIDs estables para que el mismo contrato valga
contra columnas `uuid` de Postgres).

Se ejecuta desde dos lugares:

| Adaptador | Archivo | Condición |
|---|---|---|
| In-memory | `libs/cqrs/.../in-memory/in-memory-event-store.spec.ts` (3 líneas) | siempre |
| PostgreSQL | `apps/ledger/src/shared/infrastructure/adapters/event-store/postgres-event-store.integration.spec.ts` | **solo con `RUN_PG_TESTS=1`** |

**Casos ya cubiertos que el encadenamiento debe seguir respetando:**
- `'leaves no partial events when a multi-event batch conflicts'` — batch de 2 con secuencia
  duplicada, nada persiste
- `'lets exactly one of two same-version appends win'` — dos appends concurrentes
- `'treats an empty batch as a no-op'`
- Bloque `withTransaction — cross-stream atomicity` (7 casos): commit conjunto de **varios
  streams**, rollback total, scope anidado que se une al externo

> El spec de integración inserta una fila con **SQL crudo** para probar el trigger append-only
> (omite `schema_version` y `external_ref`). Agregar `hash NOT NULL` **rompe ese INSERT**:
> hay que actualizarlo. Archivo: `postgres-event-store.integration.spec.ts`, ~línea 47.

---

## 3. La idempotencia hoy (AC-5, AC-6, AC-7)

### Cadena de ejecución completa

1. **`libs/cqrs/src/infrastructure/adapters/http/external-ref.decorator.ts`** — `@ExternalRef()`,
   header `x-external-ref` preferido, fallback a `external_ref` del body, `trim()`, `null` si
   ninguno es string no vacío.
2. **`libs/cqrs/src/application/command-bus/auth-context.type.ts`** —
   `AuthContext = { userId, clientId, externalRef: Nullable<string> }`.
3. **`libs/cqrs/src/application/command-bus/policies/idempotency.policy.ts`** — 62 líneas.
   Firma: `handle(_command: Command, ctx: AuthContext, next: CommandNext)`.
   **El command llega como parámetro pero hoy se ignora deliberadamente** (`_command`).
   - Sin `externalRef` → `next()` directo.
   - Con `externalRef` → `findByExternalRef(userId, externalRef)`; si existe, `replay(existing)`.
   - Atrapa `DuplicateExternalRefException` de la carrera concurrente → `requireAnchor` + `replay`.
   - `replay(anchor)` → `{ aggregateId, streamPosition, idempotentReplay: true }`.

   **Hay dos caminos de replay** (pre-check y catch de la carrera). AC-6 debe cubrir ambos o el
   mismatch se escapa bajo concurrencia.
4. **`libs/cqrs/src/application/command-bus/command-result.type.ts`** —
   `CommandResult = { aggregateId, streamPosition: bigint, idempotentReplay: boolean }`.
   **El flag que AC-7 necesita ya existe.**
5. **`libs/cqrs/src/infrastructure/adapters/http/command-result.interceptor.ts`** —
   `STREAM_POSITION_HEADER = 'X-Ledger-Stream-Position'`; en `finalize()` hace
   `response.setHeader(...)` y, si `idempotentReplay`, `response.status(HttpStatus.OK)`.
   **AC-7 (`Idempotency-Hit: true`) es una línea más en ese mismo `if`**, siguiendo el patrón de
   la const exportada para el nombre del header.

### `external_ref` se estampa solo en el evento ancla

**`libs/cqrs/src/application/event/envelope.factory.ts`** —
`externalRef: index === 0 ? ctx.externalRef : null`. El `external_ref_hash` hereda esa
posición: solo el ancla lo lleva, lo que encaja con el CHECK de AC-8.

### Códigos de error

- **`apps/ledger/src/shared/domain/errors/ledger-error-code.ts`** — const `LEDGER_ERROR_CODE`
  (41 códigos, agrupados por área; sección `// Platform` al final) + type `LedgerErrorCode`.
- **`apps/ledger/src/shared/infrastructure/adapters/http/ledger-error-code-mapping.spec.ts`** —
  contract test tabular congelado: cada excepción atraviesa el filter y se afirma
  `{ statusCode, code }`. **Agregar un code obliga a agregar su fila.**
- Las excepciones del event store viven en `libs/cqrs/src/domain/exceptions/event-store.exception.ts`
  y declaran su `code` por su cuenta (`DuplicateExternalRefException` → `DUPLICATE_EXTERNAL_REF`,
  extiende `DomainConflictException` de `@shared` → 409). **Ese es el patrón exacto que
  `IDEMPOTENCY_INPUT_MISMATCH` debe seguir**: excepción en `libs/cqrs`, string espejado en el
  const del ledger y fila nueva en el mapping spec.

---

## 4. El tooling (AC-4)

**`apps/ledger/src/tooling/rebuild.command.ts`** — 182 líneas, entrypoint `ts-node` con
`switch (command)` sobre `args[0]`. Subcomandos actuales: `rebuild`, `rebuildAll`,
`verify-balances`. Helper `parseArg(args, flag)` que busca el índice del flag y devuelve el
siguiente argumento. Construye `DataSource` desde `process.env.DB_URI` (default
`postgresql://postgres:postgres@localhost:5433/ledger`) y cierra con `dataSource.destroy()` en
`finally`.

**Patrón a imitar — `verify-balances`** (líneas 130-162): `parseArg(args, '--userId')`, exige el
flag (`process.exit(1)` si falta), instancia `ConsistencyVerifier`, imprime OK o la tabla de
discrepancias.

> **`verify-balances` NO setea exit code ante drift** — solo imprime. AC-4 exige exit `1`.
> El subcomando nuevo estrena ese comportamiento; queda la inconsistencia entre ambos.

**`apps/ledger/src/tooling/consistency-verifier.ts`** — patrón de verificador a espejar: clase
con constructor de puertos inyectados (`EventStore`, `ReadModelStore`, `CurrencyCatalog`,
`pageSize = 1000`), método `verifyBalances(userId): Promise<BalanceVerificationReport>`, pagina
con `readAll`. Su reporte vive aparte en **`apps/ledger/src/tooling/balance-verification-report.type.ts`**
(`{ ok: boolean, discrepancies: readonly BalanceDiscrepancy[] }`) — misma forma que necesita el
reporte de `verify-chain`.

**Targets nx** — `apps/ledger/project.json` tiene `build, serve, lint, test, rebuild,
rebuildAll, verify-balances`. Cada tooling target es:

```json
{ "executor": "nx:run-commands",
  "options": { "command": "npx ts-node -r tsconfig-paths/register apps/ledger/src/tooling/rebuild.command.ts verify-balances" } }
```

`verify-chain` necesita su target análogo. También hay que actualizar el string de `Usage:` de
`main()` (línea 39).

---

## 5. Restricciones arquitectónicas verificadas

### `libs/cqrs` no puede conocer el dominio

**`libs/cqrs/src/domain-independence.spec.ts`** — falla si cualquier archivo bajo `libs/cqrs/src`
importa `@ledger/` o `@app/`. Consecuencia directa: la excepción de AC-6 vive en `libs/cqrs` sin
poder referenciar `LEDGER_ERROR_CODE`; el string se duplica, igual que hoy con
`DUPLICATE_EXTERNAL_REF`.

### Capas internas del ledger

**`apps/ledger/src/hexagonal-isolation.spec.ts`** — `domain` no importa `application` ni
`infrastructure`; `application` no importa `infrastructure`; ninguna capa interna importa
`@nestjs/`, `typeorm`, `pg` ni `express`. Compara **segmentos de ruta**, y exime `*.spec.ts` y
`*.contract.ts`.

### Constitución del proyecto (`docs/rules.md`)

- **Artículo 1** — núcleo aislado de infraestructura
- **Artículo 3** — event store append-only; ningún `UPDATE`/`DELETE` sobre la tabla de eventos
- **Artículo 4** — TDD estricto
- **Artículo 13** — imports por ruta completa, **no por barrel**; `index.ts` nuevos solo en los
  cuatro casos listados. *Alcance explícito: `apps/ledger`, `libs/cqrs`.* Afecta dónde y cómo se
  expone la función de canonicalización.
- **Quality Gates** que `/design` debe pasar: Simplicity, Anti-Abstraction, Integration-First,
  Test-First.

### Aliases de path (`tsconfig.base.json`)

`@shared` → `libs/shared/src/index.ts` · `@shared/*` → `libs/shared/src/*` ·
`@cqrs/*` → `libs/cqrs/src/*` · `@ledger/*` → `apps/ledger/src/*` · `@app/*` → `apps/finances/src/*`

`libs/shared/src/functions/` (7 archivos, con barrel `index.ts`) es el vecindario natural de una
utilidad pura como la canonicalización.

---

## 6. Documentación viva a reconciliar

| Doc | Qué cambia |
|---|---|
| `apps/ledger/docs/shared/flows/idempotent-write.md` | Su **AC-3** documenta hoy lo contrario de AC-6: *"Reenviar el mismo `external_ref` con un command distinto replaya el resultado original en vez de rechazarlo"*. Tabla de errores fila 3 (`command distinto` → 200) y sección "Respuesta" (header nuevo). |
| `apps/ledger/docs/shared/flows/map-domain-error.md` | Fila nueva para `IDEMPOTENCY_INPUT_MISMATCH` (409) y reescritura de la **nota final sobre `DUPLICATE_EXTERNAL_REF`**, que hoy explica por qué ese 409 *nunca se emite*. |
| `apps/ledger/docs/shared/shared.c4` | `idempotencyPolicy` (línea 76) describe *"NO compara el command"*; `commandResultInterceptor` (línea 26) lista sus headers. Dynamic view `shared_http_idempotent_write` (línea 171). |
| `apps/ledger/docs/shared-kernel/shared-kernel.c4` | `postgresEventStore` (descripción de columnas/comportamiento) + componentes y dynamic view nuevos para `verify-chain`, junto a `shared_kernel_verify_balances`. |
| `apps/ledger/docs/shared-kernel/flows/` | Flow nuevo `verify-chain.md`, espejo de `verify-balances.md` (frontmatter con `trigger: cli`, `entrypoint: nx run ledger:verify-chain`). |
| `apps/ledger/docs/shared/api.yaml` | Header de respuesta `Idempotency-Hit` y el code nuevo en el enum `LedgerErrorCode`. Ya hay precedente de `headers:` (línea 55) y del param `X-External-Ref` (línea 38). |

`likec4.config.json` (raíz) fusiona todos los `.c4`; validar con `npm run docs:validate`.

---

## 7. Decisión de librería: JCS (cierra el pendiente de Q4 del `/clarify`)

Consultado el registro de npm durante este scan:

| Paquete | Versión | Veredicto |
|---|---|---|
| **`canonicalize`** | **3.0.0** | **Candidata.** Licencia Apache-2.0, 16 KB desempaquetado, tipos propios (`lib/canonicalize.d.ts`, sin `@types`). Repo `github.com/erdtman/canonicalize`, maintainer `samuelerdtman <samuel@erdtman.se>` — **Samuel Erdtman es co-autor del RFC 8785**. |
| `json-canonicalize` | 2.0.0 | Alternativa; sin la procedencia del autor del RFC. |
| `@tufjs/canonical-json` | 2.0.0 | **No sirve** — implementa el canonical JSON de TUF, que **no es** RFC 8785. Trampa a evitar. |
| `rfc8785` | — | No existe en el registro (404). |

Hoy no hay ninguna instalada: `package.json` no declara nada que matchee `/canon|jcs|json-stable|hash/`.

---

## 8. Gaps y tensiones detectadas (para `/design`)

### G-1 · CRÍTICO — El Artículo 6 de la constitución contradice AC-6

`docs/rules.md`, Artículo 6 (*Idempotencia por referencia externa*): *"Todo command que acepte
`external_ref` es idempotente: repetirlo con la misma referencia para el mismo usuario nunca
emite eventos nuevos, **y retorna el resultado original**"*.

AC-6 cambia esto: misma referencia + inputs distintos → **409, no el resultado original**. La
constitución es norma del proyecto (CLAUDE.md manda validar contra ella). `/design` tiene que
enmendar el artículo o declararle una excepción explícita — no puede ignorarlo.

### G-2 · CRÍTICO — `external_ref_hash` no puede calcularse donde la HU manda calcularlo

La Regla de Negocio de la HU dice que el hash *"vive en el adaptador `PostgresEventStore`… el
núcleo no sabe que existe"*. Eso funciona para el `hash` de cadena (AC-2), que se deriva del
envelope. **No funciona para AC-5**: `external_ref_hash` se deriva del **`Command`**, y el
`EventStore` nunca ve un `Command` — solo recibe `EventEnvelope[]`.

Solo `IdempotencyPolicy` (capa de aplicación) tiene el command. Las salidas posibles —campo
nuevo en `EventEnvelope`, parámetro nuevo en el puerto, o mover ese cálculo a la política— son
todas decisiones de `/design`, y todas tocan el contrato del puerto.

### G-3 · CRÍTICO — No existe serialización de appends por usuario

La Regla de Negocio asume que *"el encadenamiento serializa los appends por usuario"*, pero hoy
**no hay ningún mecanismo que lo garantice**. El único constraint es
`UNIQUE (aggregate_id, sequence)`, que serializa por **agregado**, no por usuario. Dos appends
concurrentes a agregados distintos del mismo usuario leerían el mismo `prev_hash` y romperían la
cadena sin que ningún constraint lo note.

Hace falta un mecanismo explícito (advisory lock por `user_id`, `SELECT … FOR UPDATE` sobre una
fila ancla, o un UNIQUE sobre `(user_id, hash)`). El contract test ya tiene un caso de appends
concurrentes que va a ejercitar esto.

### G-4 · ALTO — Encadenar dentro de un `INSERT` multi-fila y dentro de `withTransaction`

Dos niveles de anidamiento que el diseño debe resolver juntos:
- **Dentro del batch:** `insertAll` inserta N eventos en un solo `INSERT … VALUES (…), (…)`. El
  hash del evento N depende del N−1 del mismo batch, que todavía no está en la tabla.
- **Dentro de la transacción:** `withTransaction` permite appends a **varios streams** del mismo
  usuario (7 casos del contract test lo cubren). Todos comparten la misma cadena de usuario y
  deben encadenarse en orden.

### G-5 · MEDIO — El hash no puede subir al tipo de dominio sin contradecir la HU

`verify-chain` necesita leer el `hash` persistido, pero `StoredEvent` es un tipo de dominio y la
HU dice que el núcleo no conoce el hash. O el tooling lee por SQL directo (fuera del puerto), o
`StoredEvent`/`EventStoreRow` ganan el campo y la Regla de Negocio se matiza.

### G-6 · MEDIO — El contract test contra Postgres real está apagado por defecto

`RUN_PG_TESTS` no está seteado, así que el encadenamiento sobre PostgreSQL —donde viven la
concurrencia real y el CHECK— **no se verifica en la corrida normal de tests**. El in-memory sí.
`/plan` debe decidir si la historia exige correr con `RUN_PG_TESTS=1` para considerarse verde.

### G-7 · BAJO — Solapamiento semántico entre los dos códigos de error

`map-domain-error.md` reserva hoy `DUPLICATE_EXTERNAL_REF` (409) para *"mismo `external_ref` con
un command distinto/conflictivo"* — literalmente el caso que AC-6 bautiza
`IDEMPOTENCY_INPUT_MISMATCH`. Dos códigos para un caso: `/design` decide si el viejo se redefine
(queda como contrato del puerto para callers sin política) o se deprecia.

### G-8 · BAJO — Ruptura mecánica del INSERT crudo del spec de integración

El test del trigger append-only en `postgres-event-store.integration.spec.ts` inserta con SQL
crudo omitiendo columnas. Con `hash NOT NULL` deja de compilar contra el esquema nuevo.
