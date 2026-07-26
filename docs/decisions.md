# Decisiones de Diseño — admin-back

> Log acumulativo de decisiones significativas de diseño, tomadas literalmente
> de la sección "Decisiones de Diseño" de cada historia que las generó (no
> solo las cross-cutting — también decisiones de un solo módulo). Lo mantiene
> `/sync` automáticamente al cerrar cada historia. Append-only: las entradas
> nunca se editan ni se borran; una decisión obsoleta se supersede con una
> entrada nueva que la referencia. Orden cronológico inverso (más reciente
> primero).

## HU-0016 — Re-evaluación de aserciones ante anulaciones (2026-07-26)

- **Solo `TransactionVoided` lleva disparador:** verificado contra `AssertionPostingReader`
  (devuelve `CONFIRMED`+`PENDING`, excluye `VOIDED`) y `AssertionEvaluator` (suma sin
  discriminar por estado). `Confirmed` no cambia el monto evaluado y `Reversed` ya se cubre
  por el `TransactionRecorded` de la reversa. AC-2 se reescribió con esa evidencia y la
  historia deja dos tests que la documentan.
- **El reactor lee `proj_postings` por `transaction_id`:** sin cambio de esquema de eventos
  y sin lag, porque esa proyección es síncrona (§8.1) y el pump proyecta antes de reaccionar
  (hu-0015). Se descartó enriquecer el payload de los eventos, que habría exigido
  `schema_version` 2 + upcasting (RNF-6) sin resolver los eventos ya escritos.
- **Se extiende `AssertionPostingReader`** con `touchedByTransaction` en vez de crear un
  puerto nuevo: mantiene un único punto de acceso del módulo a `proj_postings` (DRY).
- **La atomicidad cross-stream sale a hu-0023:** es integridad transaccional, no
  re-evaluación, y alcanza también a `MergePendingTransfers`.

> Alternativas evaluadas y descartadas: [`docs/research.md`](./docs/research.md).

---

## HU-0015 — Persistencia Postgres de las proyecciones de conciliación (2026-07-26)

`/scan` no dejó marcadores `[NEEDS CLARIFICATION]`, pero sí destapó dos hechos que
obligaron a decidir sin poder preguntar (la ejecución fue pedida como automática). Ambas
decisiones están razonadas en [`docs/research.md`](./docs/research.md) con sus alternativas:

- **Escritura por el `ReadModelStore` genérico:** los projectors escriben con
  `store.upsert(table, key, row)` y los puertos `AssertionStatusStore`/`AdjustmentAuditStore`
  pierden sus métodos de escritura, quedando como puertos de **lectura** — es la única
  forma de cumplir el contrato `Projector` y que `ProjectionRebuilder` pueda truncar.
- **Una sola proyección `reconciliation` con dos projectors:** `AdjustmentAuditProjector`
  lee `proj_assertions`, así que ambas comparten checkpoint y orden. Registrarlas por
  separado permitiría un `rebuild adjustment_audit` aislado que produce un audit incorrecto
  en silencio.
- **Projectors movidos a `infrastructure/projections/`:** el Artículo 1 prohíbe `@nestjs/*`
  en `application/`, y ambos están hoy en `application/projectors/` con `@Injectable()`.
- **`PostgresProjectionCheckpointRepository` nuevo:** la tabla `projection_checkpoints`
  existe desde `1790000000002` pero nunca se usó; sin ella el pump reprocesa el stream
  entero en cada arranque.
- **El pump se dispara periódicamente (`@nestjs/schedule`):** `pump()` no lo llamaba nadie
  en producción. Sin disparador, la historia entrega tablas Postgres que nadie llena y el
  *Para* de la historia no se puede cumplir. **Excede el texto literal de los AC** — ver
  «Excepciones» al final.
- **El pump conserva el orden proyectar → reaccionar:** un único bucle con un único
  checkpoint, en vez de dos pollers independientes que permitirían al reactor adelantarse a
  las proyecciones.

---

## Alcance del ledger acotado a su núcleo contable (2026-07-25)

Supersede el alcance de §4.1 de `ledger-spec.md` y las épicas EP-4/EP-5 del roadmap.

**Decisión.** `apps/ledger` es un ledger de partida doble y nada más: cuentas,
transacciones, conciliación, fusión de transferencias, settings y catálogo de monedas.
Todo lo que no genera ni valida un asiento sale del alcance.

**Motivación.** La propia spec ya lo señalaba y se resolvió al revés:

- Principio de diseño **#7**: *"agrupaciones, vistas consolidadas y conversiones de moneda
  para reportes viven en proyecciones y capa de producto, **fuera del núcleo contable**"*.
  EP-4.5 (`net_worth`) y EP-4.6 (`/reports/*`) lo contradicen frontalmente.
- §4.3 admite *"un solo bounded context (Ledger) **con producto embebido** — evita
  sobre-ingeniería en v1; **extraíble por eventos si crece**"*, con reversibilidad *Media*.
  Se ejerce esa salida ahora, antes de construirlo, en vez de después.

**Dentro del alcance:** EP-1, EP-2, EP-3.1–3.6 (conciliación completa: es el principio #6 y
RF-17..RF-20, contabilidad pura), `MergePendingTransfers` (RF-16), `LedgerSettings` (el
`timezone` es el parámetro del que RNF-7 deriva el cierre de día de las aserciones, y EP-3 ya
lo consume), y el catálogo de monedas con `minor_units` (lo exige `Money` por INV-8/RNF-2).

**Fuera del alcance:** `Budget` (RF-24) y `Goal` (RF-25) — no emiten postings ni alteran
saldos; valoración `net_worth` (RF-23) y reportes consolidados; el feed de tasas de cambio
(RF-22), que es dato de referencia externo y cuyo único consumidor era la valoración; y la
proyección `transfer_candidates` (RF-15), que es una sugerencia heurística con ventana
calibrable (`TRANSFER_WINDOW_DAYS`) — la spec §8.2 la tenía como pregunta abierta #4 sin
resolver. Un ledger valida un merge que le nombran; no adivina cuál proponer.

**EP-5 se disuelve como épica.** No existe en la spec (§11 define 4 fases) y mezclaba tres
cosas sin relación: retirar módulos de `finances` (trabajo sobre otra app), backups y runbook
(operabilidad de plataforma), y OTel (RNF-12, transversal). Se replanifican como tareas de
infraestructura, no como fase de construcción del ledger.

**Consecuencia inmediata.** `transfer_candidates`, su store, su proyector, el endpoint
`GET /transfers/candidates` y el `TransferDetector` con ventana temporal se removieron. La
regla de pareo sobrevive como `TransferPairRule` (montos opuestos que netean a cero, misma
moneda, cuentas reales distintas), ahora sin ventana ni tolerancia, usada por
`MergePendingTransfersHandler` para validar el par que el cliente nombra.

De paso se corrigió una violación de RNF-10 que venía con ese diseño: el handler decidía un
invariante leyendo una proyección (`TransferCandidateStore`). Ahora carga ambos agregados
desde el event store vía `LedgerTransactionRepository` y valida contra ellos.

---

## Deuda conocida — `nx build ledger` falla con 115 errores (2026-07-25)

Registrado al cerrar HU-0012/0013/0014. **La app no compila**, así que tampoco arranca.

- Los 115 errores están confinados a `settings`, `reference`, `reporting` y `product`:
  andamiajes de EP-3/EP-4 escritos contra un layout de imports viejo (59 de 115 son `TS2307`,
  módulo no encontrado — p.ej. `shared-kernel/application/command/command-bus`, que hoy es
  `command-bus/command-bus`). Cuatro suites de test del módulo `settings` ni siquiera
  compilan por la misma causa.
- **Cero errores** en `accounts`, `transactions`, `shared`, `shared-kernel` y `ledger` — el
  código de las tres HU de EP-2 está limpio y sus 387 tests pasan.
- `app.module.ts` importa `SettingsModule`, así que el fallo alcanza al arranque. Los otros
  tres módulos rotos no están cableados (hay un comentario en `app.module.ts` que lo declara
  pendiente de migración), pero TypeScript los compila igual por estar en el proyecto.
- **Decisión:** no se reparan en estas HU — pertenecen a épicas no iniciadas y las tres
  historias los listan explícitamente como *Fuera de Alcance*. Se registran como deuda. Las
  opciones evaluadas fueron repararlos (trabajo grande, fuera de alcance) o desconectarlos de
  `app.module.ts` para recuperar el arranque (cambio chico); se difiere la elección a la
  historia que retome EP-3/EP-4.

---

## HU-0014 — Endpoints de transacciones — ciclo de vida completo (2026-07-25)

Historia de sincronización documental: el código manda sobre la especificación, **salvo en
tres defectos** que no eran divergencias de spec sino fallas, y que sí se corrigieron.

### Correcciones de código aplicadas

- **Suite e2e desbloqueada:** `accounts-api.e2e.spec.ts` y `transactions-api.e2e.spec.ts`
  fallaban 13 tests porque `LedgerCoreModule` declara `PostgresEventStore` y
  `PostgresReadModelStore` como providers y Nest los instanciaba aunque el test
  sobrescribiera los buses, exigiendo un `DataSource` inexistente. Se agregó el override de
  ambos puertos **en los tests**; producción no se tocó. 13 rojos → 0.
- **`/amend` con campos opcionales:** el DTO declaraba `postings?` y `date?` y el controller
  rellenaba con `[]` y `''`, produciendo un `422` desconcertante (`"" is not a YYYY-MM-DD
  date`) al omitirlos. Como `LedgerTransaction.amend` hace **reemplazo total**, una enmienda
  parcial no tiene representación en el dominio: se alineó el DTO haciendo ambos campos
  requeridos, así un campo faltante da un `400` de validación claro. El test que congelaba
  el bug (`controller.spec.ts`, que afirmaba `postings: []`) dejó de compilar y se reescribió
  para ejercitar un amend real.
- **Filtro `account` aplicado después de paginar:** `GET /transactions?account=X&limit=N`
  extraía una página de **todas** las cuentas y recién después la filtraba, ocultando
  coincidencias más allá de la primera página. Se reordenó: los `transaction_id` de la
  cuenta se resuelven primero y entran al criteria como `oneOf` antes de paginar. Trampa
  encontrada al hacerlo: `Criteria.oneOf` con array vacío devuelve `this` **sin filtro**, así
  que una cuenta sin postings habría devuelto todas las transacciones — se cortocircuita
  explícitamente. Además se aplicó el `limit` por defecto de 50 que el DTO anunciaba en
  Swagger pero nunca se usaba, dejando las lecturas acotadas. Se agregó
  `list-transactions.handler.spec.ts` con 4 casos.

### Divergencias documentadas (el código se mantiene)

- **AC-3 — el listado devuelve un array crudo, no una página:** no hay envoltorio con
  `total`/`limit`/`offset`; el `TransactionListDto` decora Swagger pero no se construye. Sin
  `total`, el cliente detecta el fin cuando recibe menos filas que el `limit`. Se corrige el
  AC y el `api.yaml`.
- **AC-3 — `GET /transactions/{id}` devuelve la fila cruda sin postings, o `null`:** las
  líneas viven en `proj_postings` y la ruta no las cruza; una transacción inexistente da
  `200 null`, no `404`. Mismo patrón que `GET /accounts/{id}` en HU-0013. Se elimina el `404`
  del `api.yaml`.
- **AC-3 — el rango de fechas es `from`/`to`, no `period`:** se corrige el AC.
- **AC-4 — un solo posting da `400`, no `422`:** el `ArrayMinSize(2)` del DTO rechaza en el
  `ValidationPipe` antes de llegar al agregado, dejando `INSUFFICIENT_POSTINGS` (INV-2)
  inalcanzable por HTTP. La autoridad conceptual del invariante sigue siendo el dominio, pero
  **por HTTP gana la malla de forma**; se documenta el `400` como contrato observable en vez
  de mover la validación.
- **AC-2 — `/confirm` ignora el body y `/reverse` ignora el `reason`:** ambos controllers
  declaran `_dto` y despachan solo con el `id`. Se decide **conservar los campos** en el
  contrato (evita un breaking change si se implementan) pero documentarlos explícitamente
  como sin efecto. Confirmar con postings distintos no está soportado: la vía es `amend` y
  después `confirm`.
- **AC-2 — `/annotate` tiene semántica de reemplazo total, no de parche:** los campos
  omitidos se envían vacíos (`description ?? ''`, `tags ?? []`) y **borran** el valor previo.
  Se mantiene y se documenta de forma prominente: el opcional del DTO expresa "podés no
  mandarlo", no "se preserva". Para conservar un campo hay que reenviarlo.
- **AC-6 — `ACCOUNT_CLOSED` es 422, no 409:** manda la decisión de HU-0011. Las transiciones
  de estado inválidas emiten `INVALID_TRANSACTION_STATE` (409), código que no figura en el
  const `LEDGER_ERROR_CODE` — ver la entrada de HU-0013.

---

## HU-0013 — Endpoints de cuentas — `/ledger/initialize`, `/accounts` (2026-07-25)

Historia de sincronización documental: el código manda sobre la especificación.

- **AC-10 (nuevo) — el read-side devuelve filas de proyección, no DTOs:** se mantiene lo
  implementado. Las cuatro lecturas (`GET /accounts`, `/accounts/{id}`,
  `/accounts/{id}/balance`, `/ledger/settings`) responden con la fila cruda en `snake_case`
  (`account_id`, `currency_code`, `confirmed_amount`, `presentation_currency`). Los
  `AccountDto`/`AccountTreeDto`/`AccountBalanceDto`/`LedgerSettingsDto` existen y decoran
  Swagger, pero **no se construyen**: `queryBus.ask<AccountDto>(...)` es un genérico sin
  verificación. Se corrigen los schemas del `api.yaml` para describir la fila real y se
  agrega una nota de contrato al documento. Unificar (mapper explícito o proyecciones en
  `camelCase`) es trabajo de otra HU.
- **AC-3 — `type` y `parentId` no se transportan:** se mantiene la derivación desde el
  nombre jerárquico. `Account.open` obtiene el tipo de `name.rootType` y el padre de
  `name.parentName()`; el command solo lleva `(name, currencies, openedOn, isBankMirror)`.
  Los dos campos siguen en el DTO como malla de forma, pero **el nombre es la autoridad** y
  un `type` contradictorio se ignora en silencio. Se documenta en el `api.yaml` y en
  `open-account.md` en vez de extender el command.
- **AC-4 — `?view=tree|flat` se acepta y se ignora:** se decide **no** retirar el parámetro
  del contrato (evita un breaking change cuando se implemente el shaping) pero se documenta
  explícitamente como sin efecto, con el `TODO(read-shape)` de `account-tree-view.ts` como
  referencia. La respuesta es siempre plana; el cliente puede reconstruir el árbol desde el
  nombre jerárquico.
- **AC-4 — `GET /accounts/{id}` inexistente devuelve `200 null`, no `404`:** se mantiene. El
  handler hace `row ?? null` y ninguna capa lo traduce. Se elimina el `404` del `api.yaml`,
  que prometía un comportamiento inexistente. Nota: una cuenta de otro usuario es
  indistinguible de una inexistente, lo cual es deseable (no filtra existencia entre
  usuarios).
- **AC-5 — `?currency` se acepta y se ignora:** mismo criterio que `view`. Documentado, no
  retirado.
- **AC-7 — `ACCOUNT_CLOSED` y `CURRENCY_NOT_ALLOWED` son 422, no 409:** manda la decisión de
  HU-0011 y el catálogo RF-14. Además, **ninguno de los dos es alcanzable desde los
  endpoints de cuentas**: se emiten al postear contra una cuenta cerrada o con moneda no
  permitida, que es ruta de `/transactions` (HU-0014). Se corrige el AC.
- **`LEDGER_ERROR_CODE` no es exhaustivo:** hallazgo transversal. El const declara 17
  códigos pero el API emite **39** — cada excepción declara su `code` por su cuenta y el
  `ExceptionFilter` lo expone verbatim, así que los 22 faltantes son igual de públicos y
  estables. Se documentan los 39 en el enum `LedgerErrorCode` del `api.yaml` compartido y en
  la tabla de `map-domain-error.md`, agrupados por origen. Sumarlos al const es aditivo y
  queda como trabajo de seguimiento. (Corrección sobre una lectura intermedia: no hay
  códigos catalogados que el API no emita.)

---

## HU-0012 — Read-your-writes + idempotencia por `external_ref` (2026-07-25)

Historia de sincronización documental: el código ya existía (construido como efecto
colateral de `hu-0005` y `hu-0009`) y **manda sobre la especificación**. Los AC se
corrigieron para describir el runtime, siguiendo el precedente de HU-0011.

- **AC-3 — `external_ref` es clave de reintento, no detector de colisiones:** se mantiene
  el comportamiento implementado. `IdempotencyPolicy` recibe el command como `_command` y
  nunca lo compara: cualquier reenvío del mismo `(user_id, external_ref)` replaya el
  `CommandResult` original con `200`. La `DuplicateExternalRefException` del índice único
  también se atrapa y se replaya. **Consecuencia:** `DUPLICATE_EXTERNAL_REF` queda
  inalcanzable vía HTTP; se documenta como tal en `map-domain-error.md` y en el enum
  `LedgerErrorCode` del `api.yaml`, y el código permanece porque sigue siendo contrato del
  puerto `EventStore`. Se corrige el AC de la HU en vez del código.
- **AC-5 — Read-your-writes inline pero no atómico:** se mantiene lo implementado. Los 10
  handlers hacen `repository.save(...)` y luego `dispatcher.dispatch(result.events)` como
  operaciones **secuenciales sin transacción compartida**; no existe `UnitOfWork` ni
  `queryRunner` fuera de las migraciones. El AC afirmaba "misma transacción del command
  (ACID conjunto)", lo cual es falso. Se corrige el AC. Hacerlo atómico exige un
  `UnitOfWork` compartido entre `EventStore` y `ReadModelStore` y queda para EP-3.
- **AC-6 — El gancho `min_position` no se construye:** cero ocurrencias de `min_position` /
  `X-Ledger-Min-Position` en `apps/ledger/src`. Se decide **no** agregarlo como no-op: un
  parámetro aceptado-e-ignorado es una promesa de contrato que el servidor no cumple. Se
  difiere entero a EP-3, junto con la espera activa por checkpoint. La mitad publicada del
  mecanismo (`streamPosition` en toda escritura) sí queda lista.
- **AC-4 — `CommandResultInterceptor` es opt-in, no global:** se mantiene el
  `@UseInterceptors` por controller en vez de migrar a `APP_INTERCEPTOR`. Lo declaran
  `AccountsController`, `LedgerController` y `TransactionsController`; los controllers de
  EP-3 ya montados (`BalanceAssertionController`, `TransferController`) no, así que sus
  escrituras no exponen `X-Ledger-Stream-Position`. Alinearlos pertenece a EP-3. Mover el
  interceptor a `APP_INTERCEPTOR` lo resolvería de raíz y queda registrado como opción.
- **Ubicación de los artefactos:** viven en `shared/infrastructure/adapters/http/`, no en
  `shared-kernel/`, según la decisión de RNF-11 de HU-0009. La HU no crea artefactos: el
  `@ExternalRef()` y el `CommandResultInterceptor` ya existían.

---

## HU-0011 — Códigos de error de dominio estables (RF-14) (2026-07-25)

- **Status de `ACCOUNT_CLOSED`:** **422** (se mantiene el código implementado) —
  posting a cuenta cerrada (INV-3) es una violación semántica del payload que el
  cliente corrige eligiendo otra cuenta, misma categoría que `CURRENCY_NOT_ALLOWED`;
  el mapping-spec ya lo congeló así con rationale explícito. Se corrige AC-2 de la
  HU vía `/refine`.
- **Status de `LEDGER_NOT_INITIALIZED`:** **422** (se mantiene el código
  implementado) — se agrega la fila faltante al mapping-spec y se corrige AC-2 de
  la HU vía `/refine`.
- **Ubicación de `LEDGER_ERROR_CODE`:** se mantiene en
  `apps/ledger/src/shared/domain/errors/ledger-error-code.ts` — los códigos son
  contrato de dominio (Art. 1: el dominio no importa desde `infrastructure/`) y no
  existe ningún adapter `http/` bajo shared-kernel. Se corrige la HU vía `/refine`.
- **Alcance de la tabla RF-14:** se suman **settings y Money** — las excepciones de
  settings (`InvalidCurrencyCodeException`, `InvalidTimeZoneException`) se
  reclasifican dentro de `DomainException` y las de Money reciben `code` propio;
  los 6 códigos entran a `LEDGER_ERROR_CODE` y al mapping-spec (aditivo).

---

## HU-0009 — Andamiaje del adaptador HTTP — OpenAPI/versionado + patrón controller→bus (2026-07-24)

- **AC-2 — Ruta de Swagger:** `/api/docs`, no `/api/v1/docs`. `SwaggerModule.setup` respeta `setGlobalPrefix('api')` pero no `enableVersioning` — Swagger no registra rutas por versión.
- **AC-5 — Campos de CommandAcceptedDto:** `{ id, streamPosition }` (2 campos), no `{ id, sequence, streamPosition }`. `CommandResult` expone `aggregateId`, `streamPosition` (bigint), `idempotentReplay` — no existe `sequence`.
- **RNF-11 — Ubicación del código HTTP:** `shared/infrastructure/adapters/http/`, no `shared-kernel/infrastructure/adapters/http/`. `shared-kernel/` aloja el núcleo hexagonal (domain + application ports + infra de event-store/proyecciones); `shared/` aloja código de dominio compartido y los adaptadores HTTP.
- **Estado general:** La HU documenta infraestructura ya construida. Los ACs son reformulados para reflejar el código existente. El wiring test (`app.wiring.spec.ts`) y el Swagger builder (`ledger-swagger.builder.ts`) ya pasan en verde.

## HU-0008 — Tooling de rebuild/replay + verificación de consistencia (2026-07-24)

- **`ProjectionRegistry` en `application/`:** Clase concreta que mapea nombres de proyección a
  `{ projectors, tables }`. Permite que `rebuild(projectionName)` resuelva por nombre sin
  acoplar el rebuilder a módulos concretos. Vive en `application/` porque no depende de
  infraestructura — es un `Map` puro. Ver `docs/research.md` para análisis completo.
- **Nx executor script sobre nestjs-command:** El CLI de rebuild/verify es un script standalone
  ejecutado vía `ts-node`/Nx executor, no un comando NestJS. `application/` permanece libre de
  NestJS (Artículo 1) y no se agrega ninguna dependencia nueva. Ver `docs/research.md`.
- **Verificador recalcula desde eventos del stream:** `ConsistencyVerifier.verifyBalances(userId)`
  deserializa eventos con `EventRegistry` y acumula saldos con `Money` exacto, sin depender de
  `proj_postings`. Esto verifica independientemente la corrección del proyector de balances.
  Ver `docs/research.md`.

---

## HU-0007 — Adaptadores Postgres de EventStore y ReadModelStore (2026-07-24)

Sin incógnitas — todos los contratos (`EventStore`, `ReadModelStore`,
`describeEventStoreContract`, `describeReadModelStoreContract`) ya están
definidos por HU anteriores (`hu-0002`, `hu-0004`). Esta HU corrige y verifica
las implementaciones Postgres existentes contra esos contratos.

---

## HU-0006 — Proyectores transaction_list/account_balances + query bus (2026-07-24)

No hubo incógnitas que resolver — el código ya existe. El design documenta la
arquitectura tal como está implementada, verificando contra los AC de la HU.

---

## HU-0005 — Command bus + políticas transversales + handlers núcleo (2026-07-23)

Sin unknowns pendientes — todos los artefactos descritos en `hu.md` ya están implementados en el código base. Este documento registra retroactivamente el diseño para trazabilidad. El command bus usa Chain of Responsibility con orden fijo de 3 políticas (`AuthenticatedContextPolicy` → `IdempotencyPolicy` → `OptimisticConcurrencyPolicy`) cableado en `createLedgerApplication()`. Los 8 handlers núcleo delegan en los agregados `Account`, `LedgerTransaction` y `LedgerSettings` sin lógica de negocio adicional más allá de la orquestación y validación cruzada contra `account_tree`.

---

## HU-0002 — Puerto `EventStore` + adaptador in-memory + contract tests (2026-07-23)

- **AC-11 — Ubicación del guard de lote vacío:** guard en ambos lados — `EventSourcedRepository.save()` retorna early si `pullChanges()` está vacío, **y** `InMemoryEventStore.append()` maneja `events: []` como no-op. Defensa en profundidad: el repositorio nunca llama al store sin cambios, y el store tolera lotes vacíos independientemente del caller.

---
