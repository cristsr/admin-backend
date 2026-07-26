# context: hu-0012

> **Nota de alcance:** esta historia **ya está implementada** en `apps/ledger` (mayormente
> como efecto colateral de `hu-0009` y `hu-0005`). Este scan no es pre-diseño: además del
> inventario de artefactos reutilizables, verifica el estado real del código contra cada AC
> y reporta gaps de implementación, documentación y test (ver **Gaps detectados** al final).

## Historia resumida

**Como** cliente del API del ledger (frontend o automatizador)
**Quiero** leer mis propias escrituras inmediatamente después de un `2xx`, y que reintentar
una escritura con el mismo `external_ref` sea idempotente
**Para** construir flujos confiables sin datos obsoletos ni operaciones duplicadas
(RNF-9 / RF-11 / INV-10)

## Componentes afectados

- `apps/ledger` (único). Módulos internos: `shared` (kernel HTTP), `shared-kernel`
  (command bus + policies + event store + proyección), `transactions`, `accounts`,
  `reconciliation`.
- `apps/finances` — solo como **contraejemplo** (no se reutiliza nada).

## Estado de git al escanear

- Rama actual: `feat/core` (el perfil declara `BASE_BRANCH = develop`, pero el repo usa
  `master` como rama principal — ver `git log`). Hay cambios sin commitear en
  `apps/ledger/src/shared-kernel/**` (tooling/projection-rebuilder) y en `work/`, **no
  relacionados con hu-0012**. El scan lee el árbol tal como está.
- Último commit relevante: `ac59d83 docs(ledger): archive hu-0011 story workspace`.
  No existe ningún commit etiquetado hu-0012.

---

## apps/ledger

### Kernel HTTP (módulo `shared`) — donde vive el borde de esta HU

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\infrastructure\adapters\http\`

| Artefacto | Archivo | Estado |
|---|---|---|
| `@ExternalRef()` + `extractExternalRef()` | `external-ref.decorator.ts` | **Existe** (AC-1) |
| `CommandResultInterceptor` | `command-result.interceptor.ts` | **Existe** (AC-4) |
| `CommandAcceptedDto` | `dto/command-accepted.dto.ts` | **Existe** (AC-4) |
| `SharedHttpModule` | `shared-http.module.ts` | Existe (provider, **no** `APP_INTERCEPTOR`) |
| `LedgerContextGuard` / `@Context()` | `ledger-context.guard.ts`, `context.decorator.ts` | Existe (hu-0009/hu-0010) |
| Barrel público | `index.ts` | Exporta los 4 anteriores |
| Gancho `min_position` / `X-Ledger-Min-Position` | — | **No existe** (AC-6) |

#### `external-ref.decorator.ts` (AC-1 — cumplido)

```typescript
export const EXTERNAL_REF_HEADER = 'x-external-ref';                       // :6
export function extractExternalRef(ctx: ExecutionContext): Nullable<string> // :13
export const ExternalRef = createParamDecorator(...)                        // :30
```
Orden: header `x-external-ref` (trim, no-blank) → `body.external_ref` (trim, no-blank) →
`null`. Extracción pura exportada aparte para test unitario directo.

#### `command-result.interceptor.ts` (AC-4 — cumplido en los controllers que lo aplican)

```typescript
export const STREAM_POSITION_HEADER = 'X-Ledger-Stream-Position';  // :9
function isCommandResult(value): value is CommandResult            // :16  (bigint + boolean)
response.setHeader(STREAM_POSITION_HEADER, String(value.streamPosition)); // :39
if (value.idempotentReplay) response.status(HttpStatus.OK);        // :41-43
return CommandAcceptedDto.from(value);                             // :45
```
Las lecturas (proyecciones) pasan sin tocar. El replay idempotente se downgradea a `200`.

#### `dto/command-accepted.dto.ts`

`{ id: string (uuid), streamPosition: string }` — `bigint` serializado como string decimal
(`:25`). Nunca una vista de lectura (Artículo 10 de `docs/rules.md`).

### Command bus y políticas (módulo `shared-kernel`)

**Directorio:** `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\command-bus\`

- `command-result.type.ts` → `{ aggregateId: string; streamPosition: bigint; idempotentReplay: boolean }`
- `auth-context.type.ts` → `{ userId, clientId, externalRef: Nullable<string> }`
- `command-bus.ts` → `PolicyCommandBus` (Chain of Responsibility, orden de registro)
- `policies/idempotency.policy.ts` → **la idempotencia real (INV-10)**:
  - `:23` sin `externalRef` → `next()`
  - `:25-27` `findByExternalRef` → si hay ancla, `replay(anchor)` sin ejecutar el handler
  - `:31-37` captura `DuplicateExternalRefException` (carrera) y replaya
  - `:55-61` `replay()` devuelve `{ aggregateId, streamPosition: anchor.globalPosition, idempotentReplay: true }`
- `policies/authenticated-context.policy.ts`, `policies/optimistic-concurrency.policy.ts`

### Puerto `EventStore` y adaptadores

- Puerto: `apps/ledger/src/shared-kernel/domain/ports/event-store.ts`
  (`append`, `load`, `readAll`, `findByExternalRef`; JSDoc de INV-10 en `:16-20`)
- Postgres: `.../adapters/event-store/postgres/postgres-event-store.ts`
  - `append` en transacción propia (`:45`), traduce `23505` sobre
    `idx_event_external_ref` → `DuplicateExternalRefException` (`:141-143`) y sobre
    `uq_event_aggregate_sequence` → `ConcurrencyConflictException` (`:145-147`)
- In-memory: `.../adapters/event-store/in-memory/in-memory-event-store.ts`
- Contract test compartido: `.../infrastructure/testing/event-store.contract.ts`
  (`:147` idempotencia por `external_ref`, `:166` aislamiento por usuario INV-9)
- Índice único: `apps/ledger/src/database/migrations/1790000000001-CreateEventStore.ts`

### Proyección síncrona (AC-5)

- `SynchronousProjectionDispatcher`:
  `apps/ledger/src/shared-kernel/infrastructure/adapters/projection/synchronous-dispatcher.ts`
  — corre los projectors inline sobre los eventos recién apendeados; un fallo propaga y
  aborta el command (`:19-27`).
- Cableado: `apps/ledger/src/ledger/application/ledger-application.factory.ts:62-68`
  → projectors activos: `AccountTreeProjector`, `TransactionListProjector`,
  `AccountBalancesProjector`, `LedgerSettingsProjector`.
- Tablas cubiertas: `proj_account_tree`, `proj_transaction_list`, **`proj_postings`**
  (escrita por `transaction-list.projector.ts:12`), `proj_account_balances`
  → las 4 vistas críticas que enumera AC-5.
- Alternativa asíncrona disponible pero **no cableada**: `polling-dispatcher.ts`.

### Composición / DI

- `apps/ledger/src/ledger/ledger-core.module.ts` — `@Global()`; `EventStore` →
  `PostgresEventStore`, `ReadModelStore` → `PostgresReadModelStore`, `CommandBus` vía
  `createLedgerApplication(...)`.
- `apps/ledger/src/app.module.ts` — módulos montados: `SharedHttpModule`,
  `LedgerCoreModule`, `SettingsModule` (solo projector), `AccountsHttpModule`,
  `TransactionsHttpModule`, `ReconciliationModule`, `TransactionsModule`.
  `Reference`, `Product` y `Reporting` **no están montados** (`:34-36`, pendientes de
  migración) — su código HTTP es efectivamente muerto.
- `apps/ledger/src/main.ts` — prefijo `api` + versionado URI v1 (`:28-29`),
  `ValidationPipe({ transform: true, forbidUnknownValues: false })` (`:31-36`),
  `ExceptionFilter` global (`:40`). **Sin `enableCors`**.

### Controllers de escritura (superficie afectada por AC-1/AC-4)

| Controller | Archivo | `@ExternalRef` | `CommandResultInterceptor` | Montado |
|---|---|---|---|---|
| `TransactionsController` | `transactions/infrastructure/adapters/http/transactions.controller.ts` | Sí (6 writes) | Sí (`:46`) | Sí |
| `AccountsController` | `accounts/infrastructure/adapters/http/accounts.controller.ts` | Sí (3 writes) | Sí (`:40`) | Sí |
| `LedgerController` | `accounts/infrastructure/adapters/http/ledger.controller.ts` | Sí (1 write) | Sí (`:27`) | Sí |
| `BalanceAssertionController` | `reconciliation/infrastructure/adapters/http/balance-assertion.controller.ts` | Sí (3 writes) | **No** | **Sí** |
| `TransferController` | `transactions/infrastructure/adapters/http/transfer.controller.ts` | Sí (1 write) | **No** | **Sí** |
| `LedgerSettingsController` | `settings/infrastructure/adapters/http/ledger-settings.controller.ts` | **No** | **No** | No (dead) |
| `CurrenciesController` / `PricesController` | `reference/infrastructure/adapters/http/*.controller.ts` | **No** | **No** | No (dead) |
| `ReportsController` | `reporting/infrastructure/adapters/http/reports.controller.ts` | n/a (solo lecturas) | n/a | No (dead) |

### Contrato de errores (AC-3)

- `apps/ledger/src/shared/domain/errors/ledger-error-code.ts:12` — `DUPLICATE_EXTERNAL_REF`
- `apps/ledger/src/shared-kernel/domain/exceptions/event-store.exception.ts:17` — el `code`
- Contract test tabular congelado:
  `apps/ledger/src/shared/domain/errors/ledger-error-code-mapping.spec.ts:62`
  (`DuplicateExternalRefException` → `409` + `DUPLICATE_EXTERNAL_REF`)

### Tests existentes relevantes

| Archivo | Qué cubre |
|---|---|
| `shared/infrastructure/adapters/http/external-ref.decorator.spec.ts` | AC-1 completo (header, fallback, precedencia, `null`) — 4 casos |
| `shared/infrastructure/adapters/http/command-result.interceptor.spec.ts` | AC-4 unit: header + body, downgrade a 200, no fuga de campos internos, passthrough de lecturas |
| `shared-kernel/application/command-bus/policies/idempotency.policy.spec.ts` | Replay, delegación sin ref, carrera `DuplicateExternalRef` — 5 casos |
| `shared-kernel/infrastructure/testing/event-store.contract.ts:147,166` | Idempotencia del puerto + aislamiento por usuario, corre contra in-memory y Postgres |
| `ledger/application/ledger-application.spec.ts:182` | AC-2 a nivel integración: mismo `external_ref` no emite eventos nuevos (INV-10) |
| `transactions/.../transactions-api.e2e.spec.ts:73,84,94` | AC-4 e2e (body+header), AC-1 e2e (header→dispatch), AC-2 e2e (200 en replay) — **con buses mockeados** |
| `accounts/.../accounts-api.e2e.spec.ts:72,85` | stream position en `initialize`, "read-your-writes" en `open` — **con buses mockeados** |
| `ledger/application/ledger-application.spec.ts:105,153` | Proyección efectiva tras el command (AC-5 a nivel integración, in-memory) |

### Documentación disponible

| Doc | Ruta | Cubre |
|---|---|---|
| Modelo LikeC4 del módulo `shared` | `apps/ledger/docs/shared/shared.c4` | `commandResultInterceptor` (`:26`), `commandAcceptedDto` (`:18`), vista `shared_http_command_dispatch` (`:111`) |
| Flujo command dispatch | `apps/ledger/docs/shared/flows/command-dispatch.md` | `@ExternalRef`, `X-Ledger-Stream-Position`, replay→200 (`:21-23`, `:48`, `:52-53`) |
| Flujo de errores | `apps/ledger/docs/shared/flows/map-domain-error.md:46-49,65` | Distinción replay vs. `DUPLICATE_EXTERNAL_REF` 409 |
| OpenAPI `shared` | `apps/ledger/docs/shared/api.yaml:35-56` | Schema `CommandAcceptedDto` |
| OpenAPI `transactions` / `accounts` | `apps/ledger/docs/*/api.yaml` | `CommandAccepted` con `streamPosition` |
| README `shared` | `apps/ledger/docs/shared/README.md:21,34-39` | Lenguaje ubicuo del kernel HTTP |
| Diagrama shared-kernel | `apps/ledger/docs/shared-kernel/diagram.md:10,31-34` | Secuencia de `IdempotencyPolicy` |
| Decisiones | `docs/decisions.md` | Secciones HU-0011, 0009, 0008, 0007, 0006, 0005, 0002 — **sin HU-0012** |
| Roadmap | `docs/roadmap.md:134` | **EP-2.7 sigue sin marcar** |

### Referencia explícitamente NO reutilizada

`apps/finances/**/idempotency/idempotency.interceptor.ts` — contraejemplo. El ledger no
tiene tabla de idempotencia propia ni interceptor de idempotencia: la garantía vive en
`EventStore.append` + índice único `(user_id, external_ref)`.

---

## Gaps detectados

### 1. Gaps de implementación

| # | AC / tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| I-1 | **AC-6** — gancho `min_position` / `X-Ledger-Min-Position` inexistente | Búsqueda global de `min_position\|minPosition\|Min-Position` solo matchea `work/active/hu-0012/hu.md`; no hay nada en `apps/ledger/src/**`, ni en `QueryContext` (`shared-kernel/application/query-bus/query-handler.ts`) | **Alta** | Agregar el parámetro opcional al `QueryContext` + un `@MinPosition()` param decorator análogo a `@ExternalRef()`, con implementación no-op documentada; o cerrar el AC-6 explícitamente como diferido a EP-3 vía `/refine` de `hu.md` |
| I-2 | **AC-3** — la colisión real de `external_ref` con command distinto **nunca** produce `409` | `apps/ledger/src/shared-kernel/application/command-bus/policies/idempotency.policy.ts:25-27` replaya el ancla sin comparar el command; `:31-37` además convierte el `DuplicateExternalRefException` del store en replay. No existe ninguna huella/fingerprint del command persistida para comparar | **Alta** | Decidir e implementar: (a) persistir un hash del command junto al ancla y lanzar `DuplicateExternalRefException` cuando difiera, o (b) reescribir AC-3 declarando que el `409` se reserva solo a la carrera patológica del índice único. Hoy código y `docs/shared/flows/map-domain-error.md:65` afirman algo que el runtime no cumple |
| I-3 | **AC-4** — `BalanceAssertionController` no expone `streamPosition` (ni body ni header) | `apps/ledger/src/reconciliation/infrastructure/adapters/http/balance-assertion.controller.ts:29-30` sin `@UseInterceptors(CommandResultInterceptor)`; los 3 POST llaman handlers directos que devuelven DTOs (`assert-balance.handler.ts:28` → `Promise<AssertBalanceOutputDto>`), no `CommandResult`. El controller **sí** está montado (`reconciliation.module.ts:45`) | **Alta** | Hacer que los handlers de reconciliación devuelvan `CommandResult` (o envolverlos) y aplicar `CommandResultInterceptor`; alternativamente registrar el interceptor como `APP_INTERCEPTOR` global |
| I-4 | **AC-4** — `TransferController` (`POST /transfers/merge`) tampoco expone `streamPosition` | `apps/ledger/src/transactions/infrastructure/adapters/http/transfer.controller.ts:19-20` sin `@UseInterceptors`; `merge-pending-transfers.handler.ts:47 execute(...)` no retorna `CommandResult`. Montado en `transactions.module.ts:25` | **Alta** | Igual que I-3 |
| I-5 | **AC-4** — el interceptor es opt-in por controller, no transversal | `apps/ledger/src/shared/infrastructure/adapters/http/shared-http.module.ts:19,21` lo declara como provider común, no como `{ provide: APP_INTERCEPTOR, ... }`; el `LedgerContextGuard` sí usa `APP_GUARD` (`:18`). Cada controller nuevo puede olvidarlo (y dos ya lo hicieron) | **Media** | Registrarlo como `APP_INTERCEPTOR` en `SharedHttpModule` y quitar los `@UseInterceptors` locales; el interceptor ya es no-op para lecturas (`command-result.interceptor.ts:36`) |
| I-6 | **AC-5** — read-your-writes es *inline* pero **no** transaccionalmente atómico con el append, a diferencia de lo que afirma el AC ("misma transacción del command / ACID conjunto") | `postgres-event-store.ts:45` abre su propia `dataSource.transaction(...)`; `postgres-read-model-store.ts` (`upsert`/`delete`) usa `this.dataSource.query(...)` fuera de esa transacción; `synchronous-dispatcher.ts:19-27` corre después del append. Si un projector falla, los eventos ya están commiteados y las vistas quedan desfasadas | **Media** | Propagar un `EntityManager`/unit-of-work desde el command hasta store y projectors, o corregir AC-5 y la doc para decir "inline, con compensación por rebuild" en lugar de "misma transacción" |
| I-7 | **AC-1** — `external_ref` en body no está declarado en ningún request DTO | Ningún `*.dto.ts` de `transactions`/`accounts` declara `external_ref` (grep vacío). Funciona porque el decorator lee `request.body` crudo y el `ValidationPipe` no usa `whitelist` (`main.ts:31-36`) | **Media** | Declarar el campo opcional en los request DTOs (o al menos documentarlo en OpenAPI); si algún día se activa `whitelist: true` en el `ValidationPipe`, el fallback queda invisible en Swagger pero seguiría funcionando — el riesgo real es de contrato, no de runtime |
| I-8 | **AC-4** — controllers muertos (`settings`, `reference`) escriben sin `@ExternalRef` ni `streamPosition` | `ledger-settings.controller.ts:35-55` devuelve `{ message: 'Settings updated' }`; `currencies.controller.ts` y `prices.controller.ts` POST devuelven `void`. No montados (`app.module.ts:34-36`, `settings.module.ts:6-10`) | **Baja** | Registrar como deuda: cuando se migren esos módulos deben adoptar `@ExternalRef` + `CommandResultInterceptor`. No bloquea hu-0012 |
| I-9 | Header custom no expuesto por CORS | `main.ts` no llama `app.enableCors()`; si en el futuro se sirve a un navegador cross-origin, `X-Ledger-Stream-Position` no será legible sin `exposedHeaders` | **Baja** | Anotar en la doc del flujo; añadir `exposedHeaders: ['X-Ledger-Stream-Position']` cuando se habilite CORS |

### 2. Gaps documentales

| # | AC / tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| D-1 | No existe doc de flujo propia de la HU (idempotent-write / read-your-writes) | `apps/ledger/docs/shared/flows/` contiene solo `command-dispatch.md`, `query-dispatch.md`, `map-domain-error.md`, `get-swagger-docs.md`; ningún archivo con `introduced_by: hu-0012` | **Alta** | Crear `apps/ledger/docs/shared/flows/idempotent-write.md` (frontmatter `trigger: rest`, `introduced_by: hu-0012`) describiendo AC-1..AC-6, y su `dynamic view` en `shared.c4` |
| D-2 | `X-External-Ref` (request) y `X-Ledger-Stream-Position` (response) **no aparecen en ningún `api.yaml`** | grep de `X-External-Ref\|X-Ledger-Stream-Position` sobre `apps/ledger/docs/*/api.yaml` → 0 resultados; tampoco hay `@ApiHeader`/`@ApiResponse(headers)` en los controllers | **Alta** | Agregar `parameters: [$ref: '#/components/parameters/XExternalRef']` a cada operación de escritura y `headers: { X-Ledger-Stream-Position }` a las respuestas 200/201 en `docs/shared/api.yaml`, `docs/transactions/api.yaml`, `docs/accounts/api.yaml` + decoradores `@ApiHeader` para que Swagger runtime coincida |
| D-3 | `@ExternalRef` / `extractExternalRef` no es un componente del modelo LikeC4 | `apps/ledger/docs/shared/shared.c4` declara 7 componentes (`:10-82`) y ninguno es el decorator; solo se lo nombra en la `description` de la vista (`:113`). Tampoco hay `IdempotencyPolicy` en ese modelo | **Media** | Agregar `externalRefDecorator` a `shared.c4` con `metadata { introducedIn 'hu-0012' }` y las relaciones controller→decorator→AuthContext→IdempotencyPolicy |
| D-4 | Ningún artefacto de doc está atribuido a hu-0012 | grep `hu-0012` sobre `apps/ledger/docs`, `docs/` → 0 resultados. Los componentes que la HU reclama figuran como `introducedIn 'hu-0009'` (`shared.c4:14,22,30`) y la policy como `hu-0005` (`docs/shared-kernel/component.md:48`) | **Media** | Actualizar `last_modified_by`/`introducedIn` donde hu-0012 realmente amplíe el artefacto, y dejar constancia de que el grueso ya existía (evita atribuir dos veces el mismo componente) |
| D-5 | `docs/decisions.md` sin sección HU-0012 | Secciones existentes: HU-0011, 0009, 0008, 0007, 0006, 0005, 0002 (`docs/decisions.md:11-77`) | **Media** | Al cerrar con `/sync`, anexar la sección HU-0012 con las decisiones: idempotencia en el puerto (no interceptor), `409` reservado al caso patológico, `min_position` no-op |
| D-6 | Desalineación doc↔código en AC-3 | `apps/ledger/docs/shared/flows/map-domain-error.md:49,65` documenta "mismo `external_ref` con command distinto → 409 `DUPLICATE_EXTERNAL_REF`", pero `idempotency.policy.ts:31-37` lo convierte en replay `2xx` | **Media** | Resolver junto con I-2: o se implementa la detección, o se corrige la tabla del flujo. La doc no debe prometer un status que el runtime no emite |
| D-7 | Desalineación doc↔código en AC-5 (atomicidad) | `synchronous-dispatcher.ts:6-10` y `ledger-application.factory.ts:50-54` hablan de "unit of work"/"read-your-writes"; el AC habla de "misma transacción". La implementación real usa dos conexiones (ver I-6) | **Media** | Precisar en la doc de flujo el alcance real de la garantía (inline y pre-respuesta, no atómico) |
| D-8 | `docs/roadmap.md` con EP-2.7 sin marcar | `docs/roadmap.md:134` → `- [ ] **EP-2.7** Lectura de escrituras propias ...` | **Baja** | Marcar al cerrar la HU (lo hace `/sync`) |
| D-9 | `apps/ledger/docs/shared-kernel/` sigue en formato legacy (`component.md` + `diagram.md` Mermaid) mientras el perfil declara LikeC4 como formato vigente | `apps/ledger/docs/shared-kernel/component.md`, `diagram.md` conviven con `shared-kernel.c4`; `.agents/profile.md:69` marca Mermaid como deprecado | **Baja** | Deuda documental transversal, no bloquea hu-0012; migrar el contenido de idempotencia de `diagram.md:10,31-34` al `.c4` cuando se toque ese módulo |

### 3. Gaps de test

| # | AC / tema | Evidencia | Severidad | Acción sugerida |
|---|---|---|---|---|
| T-1 | **AC-3** sin ningún test: no hay caso "mismo `external_ref` + command distinto → 409" | `idempotency.policy.spec.ts` tiene 5 casos (`:48,59,70,90,109`), ninguno compara commands distintos; `ledger-error-code-mapping.spec.ts:62` solo prueba el mapeo excepción→status, no el camino que la genera | **Alta** | Agregar el test end-to-end del caso patológico una vez decidido I-2 (y, si se difiere, un test que documente el comportamiento actual de replay) |
| T-2 | **AC-6** sin test (nada que testear porque no está implementado) | Sin ocurrencias de `min_position` en `apps/ledger/src/**` | **Alta** | Test-first: escribir el spec del gancho no-op antes de implementarlo (Artículo 4 de `docs/rules.md`) |
| T-3 | **AC-5** sin e2e HTTP real: los e2e que dicen "read-your-writes" corren con buses mockeados | `accounts-api.e2e.spec.ts:23` (`'Accounts API (e2e, buses mocked)'`) y `:85`; `transactions-api.e2e.spec.ts:21`. La cobertura real está solo a nivel `ledger-application.spec.ts:105,153` (in-memory, sin HTTP) | **Alta** | Agregar un e2e con el core real (in-memory event store + read model) que haga `POST /api/v1/transactions` → `GET /api/v1/transactions/:id` sin espera intermedia, y otro contra `GET /api/v1/accounts/:id/balances` |
| T-4 | **AC-2** sin e2e sobre buses reales: el "200 en replay" del e2e usa un `dispatch` mockeado | `transactions-api.e2e.spec.ts:94-101` mockea el `CommandResult` con `idempotentReplay: true`; la única verificación de "no se emiten eventos nuevos" es `ledger-application.spec.ts:182` (sin HTTP) | **Media** | Un e2e con core real: doble `POST` con el mismo `X-External-Ref` → mismo `streamPosition`, mismo body, `eventStore.readAll()` con la misma cantidad de eventos |
| T-5 | **AC-4** sin test de cobertura transversal: nada garantiza que *toda* escritura exponga el header | Los únicos asserts del header están en `command-result.interceptor.spec.ts:34` y `transactions-api.e2e.spec.ts:81`; `BalanceAssertionController` y `TransferController` no tienen ningún test que lo verifique (y de hecho fallarían) | **Media** | Test tabular/contract que recorra las rutas de escritura registradas y afirme presencia de `X-Ledger-Stream-Position` (congela la regla, igual que hizo hu-0011 con los error codes) |
| T-6 | `external-ref.decorator.spec.ts` no cubre casos borde de header repetido (array) ni body no-objeto | `external-ref.decorator.spec.ts:9-27` cubre 4 casos; `extractExternalRef` sí maneja `typeof header === 'string'` (`:17`) y `body?.external_ref` (`:20-21`), pero sin test | **Baja** | Agregar 2 casos: header como array → cae al body; `body` `null`/string → `null` |
| T-7 | Idempotencia no verificada para todos los commands de escritura | Los `*.handler.spec.ts` mencionan `externalRef` pero la garantía se testea centralmente en la policy; Artículo 6 de `docs/rules.md` pide "tests de idempotencia por handler" | **Baja** | Evaluar si el contract test central satisface el Artículo 6; si no, agregar una suite parametrizada por command |

### Nota transversal

Ningún gap requiere código nuevo en `domain/` ni `application/` de negocio: todos los de
implementación viven en el borde HTTP (`shared/infrastructure/adapters/http`), en la policy
del bus, o en la composición (`shared-http.module.ts`). Eso mantiene el Artículo 1 de
`docs/rules.md` intacto y hace que las correcciones sean acotadas y de bajo riesgo.
