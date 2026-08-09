# design: hu-0024 — Integridad verificable del event store

## Decisiones de Diseño

- **Ruta de `external_ref_hash` (G-2):** `AuthContext` y `EventEnvelope` ganan `externalRefHash`,
  simétrico a cómo viaja hoy `externalRef` — la política lo calcula, `EnvelopeFactory` lo estampa
  en el ancla, el store lo persiste verbatim. No cambia la firma del puerto y mantiene una sola
  escritura atómica.
- **Serialización por usuario (G-3):** `pg_advisory_xact_lock(hashtext(user_id))` al inicio del
  append. Una línea, sin tabla nueva, liberado por Postgres en el commit, y re-entrante para el
  caso cross-stream de `withTransaction`.
- **Artículo 6 de la constitución (G-1):** se **reescribe**. La redacción actual no es un
  principio que hu-0024 viole sino una definición incompleta de idempotencia: la clave correcta
  es «misma referencia **y mismos inputs**».
- **Lectura del hash por el verificador (G-5):** puerto propio `EventChainReader` con adaptador
  Postgres. `StoredEvent` queda intacto y el verificador es testeable sin base.
- **Definición de "verde" (G-6):** la historia exige `RUN_PG_TESTS=1`. El advisory lock y el
  CHECK — el mecanismo central de la historia — solo existen en Postgres.
- **Librería JCS:** `canonicalize@3.0.0` (Apache-2.0, tipos propios, maintainer Samuel Erdtman,
  co-autor del RFC 8785). Ver [`docs/research.md`](./docs/research.md), decisión 1.
- **Convivencia de códigos de error (G-7, resuelta por el diseño):** reparto por capa —
  `IDEMPOTENCY_INPUT_MISMATCH` es el contrato de la política y el único que el API emite;
  `DUPLICATE_EXTERNAL_REF` se queda como contrato del puerto.

> Las seis decisiones no triviales, con opciones evaluadas y descartes, están en
> [`docs/research.md`](./docs/research.md).

## Flujo entre módulos

La historia no agrega endpoints: cambia el comportamiento de dos caminos que ya existen y agrega
un tercero de línea de comandos.

1. **Append encadenado** — todo `EventStore.append` serializa por usuario, lee el hash cabeza,
   encadena los eventos del batch en orden y los inserta con su `hash`, todo en la misma
   transacción. Flujo: [`docs/flows/event-store-append.md`](./docs/flows/event-store-append.md).
2. **Escritura idempotente estricta** — `IdempotencyPolicy` hashea los inputs del command y los
   compara contra el `external_ref_hash` del ancla: coinciden → replay con `Idempotency-Hit: true`;
   difieren → `409`. Flujo: [`docs/flows/idempotent-write.md`](./docs/flows/idempotent-write.md).
3. **Verificación de la cadena** — subcomando CLI que recomputa cada hash y reporta todas las
   rupturas con exit code apto para CI. Flujo:
   [`docs/flows/verify-chain.md`](./docs/flows/verify-chain.md).

El mapeo del código de error nuevo está en
[`docs/flows/map-domain-error.md`](./docs/flows/map-domain-error.md).

## Flujos afectados

| Operación | Flujo (slug) | Módulo | Trigger | View |
|---|---|---|---|---|
| `modify` | `event-store-append` | shared-kernel | domain-event | `shared_kernel_event_store_batch_append` |
| **`create`** | `verify-chain` | shared-kernel | cli | `shared_kernel_verify_chain` |
| `modify` | `idempotent-write` | shared | rest | `shared_http_idempotent_write` |
| `modify` | `map-domain-error` | shared | rest | `shared_http_map_domain_error` |

> **Ambigüedad para el revisor.** `event-store-append` se trató como **`modify`**: la dynamic
> view `shared_kernel_event_store_batch_append` ya existe desde hu-0007, pero nunca tuvo su
> `flows/*.md`. Se reusa el `viewId` verbatim y el flow doc nace con `introduced_by: hu-0007`
> (la historia que creó la vista), no con hu-0024. Confirmá que preferís eso a acuñar un flujo
> nuevo.

## Componentes del módulo

Cinco componentes nuevos en `admin.ledger.shared` — `canonicalJson + sha256Hex` (funciones puras
en `libs/shared`), el puerto `EventChainReader` con su adaptador `PostgresEventChainReader`, el
`ChainVerifier` con su `ChainVerificationReport`, y la excepción
`IdempotencyInputMismatchException` — más cinco modificados: `eventStore`, `postgresEventStore`,
`commandBus`, `idempotencyPolicy` y `commandResultInterceptor`.

> Delta completo del modelo: [`docs/model.delta.c4`](./docs/model.delta.c4). Los elementos van a
> dos archivos vivos distintos (`shared-kernel.c4` y `shared.c4`); el reparto está anotado en la
> cabecera del delta para que `/sync` lo aplique sin re-inferirlo.

### Cambio de contrato interno a señalar

`CommandNext` pasa de `() => Promise<CommandResult>` a
`(ctx: AuthContext) => Promise<CommandResult>`. Es lo que permite que el hash calculado por
`IdempotencyPolicy` alcance al `EnvelopeFactory` sin que el bus aprenda idempotencia. Toca las
tres políticas existentes (`next()` → `next(ctx)`) y el `reduceRight` de `PolicyCommandBus`:
mecánico, pero es un cambio de protocolo, no una adición.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** **No.**

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A

Todo el delta cae dentro de `admin.ledger.shared`, un módulo que ya existe en
`docs/architecture/landscape.c4`. No hay app nueva, módulo nuevo, actor nuevo ni integración con
un sistema externo: `canonicalize` es una dependencia npm dentro de una lib existente
(`libs/shared`), no un container ni un sistema externo del modelo C4. `verify-chain` es un
subcomando más del entrypoint de tooling que ya existe.

## Contratos por módulo

La historia **no agrega ni elimina endpoints**. Cambia el comportamiento observable de las 13
operaciones de escritura ya publicadas, con dos alcances distintos:

### shared (kernel HTTP)

| Elemento | Cambio |
|---|---|
| `components.headers.IdempotencyHit` | **Nuevo.** `Idempotency-Hit: true`, presente solo en el replay. |
| `components.parameters.ExternalRefHeader` | Descripción reescrita: la semántica de la clave cambió. |
| `components.schemas.LedgerErrorCode` | `IDEMPOTENCY_INPUT_MISMATCH` agregado al enum; nota de `DUPLICATE_EXTERNAL_REF` reescrita. |

### accounts · transactions (10 operaciones — con interceptor)

| Método | Ruta | Cambio |
|---|---|---|
| POST | `/ledger/initialize` | `200` gana `Idempotency-Hit`; `409` gana `IDEMPOTENCY_INPUT_MISMATCH` |
| POST | `/accounts` | ídem |
| POST | `/accounts/{id}/rename` | ídem |
| POST | `/accounts/{id}/close` | ídem |
| POST | `/transactions` | ídem |
| POST | `/transactions/{id}/amend` | ídem |
| POST | `/transactions/{id}/annotate` | ídem |
| POST | `/transactions/{id}/confirm` | ídem |
| POST | `/transactions/{id}/void` | ídem |
| POST | `/transactions/{id}/reverse` | ídem (su `200` no está documentado hoy — gap preexistente) |

### reconciliation (3 operaciones — sin interceptor)

| Método | Ruta | Cambio |
|---|---|---|
| POST | `/balance-assertions` | Solo `409 IDEMPOTENCY_INPUT_MISMATCH` |
| POST | `/balance-assertions/{id}/revoke` | Solo `409 IDEMPOTENCY_INPUT_MISMATCH` |
| POST | `/balance-assertions/{id}/resolve` | Solo `409 IDEMPOTENCY_INPUT_MISMATCH` |

> **Hallazgo de alcance.** `CommandResultInterceptor` es opt-in por controller
> (`@UseInterceptors`), y `BalanceAssertionController` / `TransferController` no lo declaran — la
> misma limitación preexistente que ya los deja sin `X-Ledger-Stream-Position` ni downgrade a
> `200`. Por eso **AC-7 no los alcanza**. AC-6 sí: la política corre en el chain para todos los
> commands. Corregir esa asimetría está fuera del alcance de esta historia.

> Schemas, cabeceras y descripciones completas: [`docs/api.delta.yaml`](./docs/api.delta.yaml).
> Los cinco chequeos de validación del contrato pasan.

## Modelado de datos

Sin tabla nueva. `event_store` gana `hash CHAR(64) NOT NULL`, `external_ref_hash CHAR(64) NULL` y
el CHECK `(external_ref IS NULL) = (external_ref_hash IS NULL)`, reescribiendo la migración de
creación sobre base limpia.

> DDL completo, razones de tipo y nulabilidad, e impacto en el código de persistencia:
> [`docs/data-model.md`](./docs/data-model.md).

## Enmienda a la constitución

`docs/rules.md`, **Artículo 6 — Idempotencia por referencia externa**. El principio pasa a ser:

> Todo command que acepte `external_ref` es idempotente: repetirlo con la misma referencia **y
> los mismos inputs** para el mismo usuario nunca emite eventos nuevos y retorna el resultado
> original. Repetirlo con la misma referencia e **inputs distintos** se rechaza de forma
> explícita (`IDEMPOTENCY_INPUT_MISMATCH`, 409): devolver el resultado viejo perdería la
> operación nueva en silencio.

No es una excepción a la norma sino una corrección de la norma, decidida en PHASE 3. La edición
de `docs/rules.md` es una tarea del plan, no un efecto colateral de `/sync`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Advisory lock en vez de tabla `event_chain_head`; dos funciones puras en vez de un servicio inyectable; sin tabla nueva ni endpoint nuevo. |
| Anti-Abstraction | ⚠️ | `canonicalize` se usa directo, sin wrapper — pero `EventChainReader` **sí** agrega un puerto. Ver excepción justificada abajo. |
| Integration-First | ✅ | `docs/api.delta.yaml` está escrito y validado (5/5 chequeos) antes de tocar código, y el contract test compartido del `EventStore` se extiende antes que los adaptadores. |
| Test-First | ✅ | El plan escribirá primero los vectores del RFC 8785, luego los casos de cadena en `event-store.contract.ts`, y recién después los adaptadores. Se garantiza en `/plan`. |

### Verificación por artículo

| Artículo | Estado | Nota |
|---|---|---|
| 1 — Núcleo aislado | ✅ | El hash de cadena vive en el adaptador. `EventChainReader` es un `abstract class` con contract test, exactamente el patrón que el artículo prescribe. |
| 3 — Append-only | ✅ | El encadenamiento solo agrega columnas al `INSERT`; el trigger sigue rechazando `UPDATE`/`DELETE`. La opción que requería un `UPDATE` post-append se descartó por este artículo. |
| 4 — TDD estricto | ✅ | Ver Test-First. |
| 5 — Aislamiento por usuario | ✅ | La cadena, el lock y la verificación son todos por `user_id`; el verificador nunca cruza usuarios. |
| 6 — Idempotencia | ⚠️→✅ | Contradicción resuelta enmendando el artículo (ver arriba), no desviándose de él. |
| 7 — Dinero sin float | ✅ | Los montos entran al hash como los strings decimales que ya son en el payload; la canonicalización JCS nunca los convierte a `number`. |
| 8 — Comentarios en inglés | ✅ | El código y su JSDoc en inglés; esta documentación en español, como manda `CLAUDE.md`. |
| 9 — Versionado de eventos | ✅ | No se reescribe ningún evento. La migración se reescribe sobre base limpia, que es distinto y está habilitado por `CLAUDE.md`. |
| 13 — Imports por ruta completa | ✅ | Sin barriles nuevos: la canonicalización entra al `index.ts` de `libs/shared/src/functions/`, que ya existe. |

## Excepciones a la constitución

- **Anti-Abstraction Gate — puerto `EventChainReader`:** se agrega una abstracción donde el gate
  pide usar lo directo. Se justifica porque **el puerto es lo que hace verificable el
  requisito**: las alternativas eran exponer el hash en `StoredEvent` (contradice la Regla de
  Negocio de la HU y se lo muestra a todo consumidor del puerto, incluidos projectors que no lo
  necesitan) o hacer SQL crudo desde el tooling (deja AC-4 sin test posible sin una base viva).
  El Artículo 1 además prescribe este patrón exacto — `abstract class` + contract test — para
  todo acceso a infraestructura. **Pendiente de tu aprobación en PHASE 5.**

- **Desviación menor de una preferencia de `/clarify`:** en la Q3 marcaste «abstract class como
  token DI» para la canonicalización. El diseño la deja como **dos funciones puras importadas
  directo**: sin I/O ni estado, no hay nada que inyectar ni que sustituir en un test, y un token
  DI solo agregaría ceremonia. La opción estaba redactada como condicional («*si* debe exponerse
  como puerto inyectable») y la condición no se cumple. El puerto inyectable sí aparece, pero
  para el `EventChainReader`, donde hay I/O real. Decime si preferís lo contrario.

## Riesgo conocido

`npx likec4 validate` reporta **6 errores** con el delta presente, todos «Duplicate view» sobre
los tres `viewId` que las vistas en `modify` reusan a propósito. La línea base sin el delta es
`✓ Valid (7 files)`. Es una consecuencia inherente de que un delta de `modify` cargue el `viewId`
estable — que es lo que la skill `design` exige para que `/sync` reemplace la vista en vez de
duplicarla — y desaparece al reconciliar. **No hay errores de modelo reales.**
