# design: hu-0013

> **Historia de sincronización documental — diseño *as-built*.** El código de EP-2.4 ya
> está implementado y verde; este documento describe el diseño **tal como está construido**,
> no un diseño a construir. El código manda sobre la especificación (mismo criterio que
> HU-0011 y HU-0012): `hu.md` ya fue corregido para describir el runtime real, incluido el
> AC-10 nuevo sobre que el read-side devuelve filas crudas de proyección.
>
> **No hay delta que reconciliar:** la reconciliación documental ya se ejecutó a mano en
> esta sesión sobre los docs vivos. Ver [Estado de reconciliación documental](#estado-de-reconciliación-documental).

## Resumen del diseño as-built

Dos driving adapters HTTP en `apps/ledger/src/accounts/infrastructure/adapters/http/`,
registrados por `AccountsHttpModule` (sin providers propios: los buses son globales de EP-1):

- **`LedgerController`** (`@Controller({ path: 'ledger', version: '1' })`) — ciclo de vida a
  nivel ledger: `POST /ledger/initialize` y `GET /ledger/settings`. Vive físicamente bajo el
  módulo `accounts` aunque despacha `InitializeLedgerCommand` del módulo satélite
  `apps/ledger/src/ledger/`, porque el efecto observable de inicializar es la aparición de
  las cuentas técnicas de sistema.
- **`AccountsController`** (`@Controller({ path: 'accounts', version: '1' })`) — apertura,
  renombre, cierre y las tres lecturas de cuentas.

Ambos son adapters puros (RNF-10 / Artículo 10): reciben el contexto autenticado vía
`@Context()` y la clave de idempotencia vía `@ExternalRef()`, arman el `AuthContext`
(escritura) o el `QueryContext` (lectura) y delegan en el bus. Cero lógica de dominio, cero
criteria, cero SQL. `CommandResultInterceptor` (compartido, `@UseInterceptors` a nivel de
clase en los dos controllers) convierte el `CommandResult` en `CommandAcceptedDto`, estampa
el header `X-Ledger-Stream-Position` y degrada un replay idempotente a `200`.

### Escrituras (command side)

| Ruta | Command construido | Notas as-built |
|---|---|---|
| `POST /ledger/initialize` | `new InitializeLedgerCommand(dto.presentationCurrency, dto.timezone)` | `InitializeLedgerHandler` crea `Equity:OpeningBalances` y `Equity:Adjustments` como cuentas de sistema y emite `LedgerInitialized`; el stream del ledger es el ancla de idempotencia (los dos appends de cuenta van con `externalRef: null`). |
| `POST /accounts` | `new OpenAccountCommand(dto.name, dto.currencies, dto.openedOn, dto.isBankMirror)` | `type` y `parentId` se validan en el DTO pero **no se transportan**: `Account.open` deriva tipo y padre del nombre jerárquico. |
| `POST /accounts/{id}/rename` | `new RenameAccountCommand(id, dto.newName)` | `@HttpCode(200)` — sub-recurso POST de acción, no `PATCH`. |
| `POST /accounts/{id}/close` | `new CloseAccountCommand(id, dto.closedOn)` | `@HttpCode(200)` — no `DELETE`. |

### Lecturas (query side)

| Ruta | Query | Handler → proyección | Forma real de la respuesta |
|---|---|---|---|
| `GET /ledger/settings` | `GetLedgerSettingsQuery` | `GetLedgerSettingsHandler` → `proj_ledger_settings` | `LedgerSettingsRow` o `null` (`user_id`, `presentation_currency`, `timezone`, `opening_balances_account_id`, `adjustments_account_id`, `is_initialized`) |
| `GET /accounts` | `GetAccountTreeQuery` | `GetAccountTreeHandler` → `proj_accounts`, filtrado por `user_id`, `ORDER BY name ASC` | **Array plano** de filas; no el objeto `{ view, accounts }` que declara `AccountTreeDto` |
| `GET /accounts/{id}` | `GetAccountByIdQuery(id)` | `GetAccountByIdHandler` → `proj_accounts` por `user_id` + `account_id` | Fila o `null` (`200` con cuerpo `null` si no existe) |
| `GET /accounts/{id}/balance` | `GetAccountBalancesQuery(id)` | `GetAccountBalancesHandler` → `proj_balances` cruzado con `proj_accounts` para aislar por usuario | Array de `{ account_id, currency_code, confirmed_amount, pending_amount }` |

Los cuatro handlers aplican `ctx.userId` siempre (INV-9 / Artículo 5). El balance nunca se
escribe (INV-5): solo se proyecta.

### DTOs

`apps/ledger/src/accounts/infrastructure/adapters/http/dto/` (11 archivos + `index.ts`):

- **Request (malla de forma, AC-9):** `InitializeLedgerRequestDto`, `OpenAccountRequestDto`,
  `RenameAccountRequestDto`, `CloseAccountRequestDto`.
- **Query string (validados y luego ignorados):** `AccountTreeQueryDto` (`view`, enum
  `AccountTreeView`), `AccountBalanceQueryDto` (`currency`). Ambos llegan al controller como
  `_query` y nunca cruzan al bus.
- **Response (solo documentación Swagger, no se construyen en runtime):** `AccountDto`,
  `AccountTreeDto`, `AccountBalanceDto`, `LedgerSettingsDto` — usados en `@ApiOkResponse` y
  como parámetro genérico de `queryBus.ask<T>(...)`, que no verifica ni transforma nada
  (AC-10).

### Proyecciones involucradas

`proj_accounts` (`AccountTreeProjector`, módulo `accounts`), `proj_balances`
(`AccountBalancesProjector`, módulo `transactions`) y `proj_ledger_settings`
(`LedgerSettingsProjector`, módulo `ledger`). Ninguna se crea ni se modifica en esta HU: se
consumen tal cual. Read-your-writes lo garantiza el despacho síncrono de proyecciones de
HU-0012.

## Flujos afectados

| Operación | Slug | Módulo | Trigger | Entrypoint |
|---|---|---|---|---|
| `create` | `initialize-ledger` | accounts | rest | `POST /api/v1/ledger/initialize` |
| `create` | `get-ledger-settings` | accounts | rest | `GET /api/v1/ledger/settings` |
| `create` | `get-account-by-id` | accounts | rest | `GET /api/v1/accounts/{id}` |
| `modify` | `list-accounts` | accounts | rest | `GET /api/v1/accounts` |
| `modify` | `open-account` | accounts | rest | `POST /api/v1/accounts` |
| `modify` | `get-account-balances` | accounts | rest | `GET /api/v1/accounts/{id}/balance` |

`rename-account` y `close-account` no se tocan: su documentación de HU-0003 ya describe el
runtime actual.

## Componentes del módulo

Un componente nuevo en `admin.ledger.accounts`: **`LedgerController`**
(`Infrastructure · REST`, `metadata { introducedIn 'hu-0013' }`), con sus dos aristas hacia
`admin.ledger.shared.commandBus` y `admin.ledger.shared.queryBus`. El resto
(`AccountsController`, agregado, handlers, repositorio, projector) ya existía; esta HU
completa la descripción del `AccountsController` con sus seis rutas. Modelo estructural y
dynamic views: [`apps/ledger/docs/accounts/accounts.c4`](../../../apps/ledger/docs/accounts/accounts.c4).

## Decisiones de Diseño

> ⚠️ **Estas decisiones YA fueron appendeadas a [`docs/decisions.md`](../../../docs/decisions.md),
> sección «HU-0013 — Endpoints de cuentas — `/ledger/initialize`, `/accounts` (2026-07-25)»,
> durante esta misma sesión.**
> **`/sync` NO debe volver a appendearlas** — hacerlo produciría una entrada duplicada. Lo
> que sigue es un resumen de referencia, no el texto a promover.

Resumen de las decisiones registradas en esa entrada:

- **AC-10 (nuevo) — el read-side devuelve filas de proyección, no DTOs.** Se mantiene lo
  implementado; se corrigen los schemas del `api.yaml` para describir la fila real en
  `snake_case` y se agrega una nota de contrato. Unificar (mapper explícito o proyecciones
  en `camelCase`) es trabajo de otra HU.
- **AC-3 — `type` y `parentId` no se transportan.** El nombre jerárquico es la autoridad; un
  `type` contradictorio se ignora en silencio. Se documenta en vez de extender el command.
- **AC-4 — `?view=tree|flat` se acepta y se ignora.** No se retira del contrato (evita un
  breaking change cuando se implemente el shaping); se documenta como sin efecto, con el
  `TODO(read-shape)` de `account-tree-view.ts` como referencia.
- **AC-4 — `GET /accounts/{id}` inexistente devuelve `200 null`, no `404`.** Se elimina el
  `404` del `api.yaml`. Efecto lateral deseable: una cuenta ajena es indistinguible de una
  inexistente.
- **AC-5 — `?currency` se acepta y se ignora.** Mismo criterio que `view`.
- **AC-7 — `ACCOUNT_CLOSED` y `CURRENCY_NOT_ALLOWED` son `422`, no `409`,** y ninguno es
  alcanzable desde los endpoints de cuentas (se emiten en rutas de `/transactions`, HU-0014).
- **`LEDGER_ERROR_CODE` no es exhaustivo** (hallazgo transversal): el const declara 17
  códigos y el API emite 39; los 39 quedan documentados en el `api.yaml` compartido y en
  `map-domain-error.md`. Sumarlos al const es aditivo y queda como seguimiento.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** **No.**

El alcance es interno al módulo `accounts` de `apps/ledger`: la HU agrega un componente C4
Nivel 3 (`LedgerController`) dentro de un módulo ya modelado, que se comunica exclusivamente
con el `commandBus` y el `queryBus` compartidos, ya presentes en el landscape. No agrega ni
quita ningún app, microservicio, lib compartida, integración externa ni actor: el actor
`user` y el container `admin.ledger` ya existen, y no aparece ningún consumidor o sistema
externo nuevo.

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A

> `/sync` **no** debe invocar `/architecture` para esta HU.

## Estado de reconciliación documental

El delta (`docs/model.delta.c4`, `docs/api.delta.yaml`, `docs/flows/*.md`) **no aplica**: ya
fue mergeado a mano en los docs vivos durante esta sesión. `work/active/hu-0013/` no contiene
carpeta `docs/` a propósito. Emitir un delta ahora duplicaría contenido ya publicado.

| Artefacto vivo | Estado | Qué se reconcilió |
|---|---|---|
| `apps/ledger/docs/accounts/accounts.c4` | ✅ reconciliado | Componente `LedgerController` (+ `introducedIn 'hu-0013'`) y sus 2 aristas; dynamic views nuevas `initializeLedger`, `getLedgerSettings`, `getAccountById`; `listAccounts` corregida (título «lista plana» + `?view` ignorado). Sin tags `#delta-*` ni prefijos `[NEW]`/`[CHANGED]` pendientes de limpieza. |
| `apps/ledger/docs/accounts/flows/initialize-ledger.md` | ✅ nuevo | `introduced_by: hu-0013` |
| `apps/ledger/docs/accounts/flows/get-ledger-settings.md` | ✅ nuevo | `introduced_by: hu-0013` |
| `apps/ledger/docs/accounts/flows/get-account-by-id.md` | ✅ nuevo | `introduced_by: hu-0013` |
| `apps/ledger/docs/accounts/flows/list-accounts.md` | ✅ corregido | `last_modified_by: hu-0013` — `?view` ignorado, respuesta siempre plana |
| `apps/ledger/docs/accounts/flows/open-account.md` | ✅ corregido | `last_modified_by: hu-0013` — el nombre es la autoridad; `type`/`parentId` no se transportan |
| `apps/ledger/docs/accounts/flows/get-account-balances.md` | ✅ corregido | `last_modified_by: hu-0013` — `?currency` ignorado |
| `apps/ledger/docs/accounts/api.yaml` | ✅ reconciliado | Paths `/ledger/initialize` y `/ledger/settings`; schemas `InitializeLedgerRequest` y `LedgerSettings`; `AccountBalance` corregido a `snake_case`; `404` de `GET /accounts/{id}` eliminado; nota de contrato sobre filas crudas |
| `docs/decisions.md` | ✅ appendeado | Sección «HU-0013» — **no volver a appendear** |

**Acciones que `/sync` NO debe ejecutar para esta HU:** reconciliar delta (no existe),
appendear decisiones (ya están), invocar `/architecture` (impacto = No). Queda como trabajo
de `/sync`: archivar `work/active/hu-0013/` → `work/done/hu-0013/`.

## Contratos por componente

### ledger (app) — tags `ledger` y `accounts`

| Método | Ruta | Descripción de negocio |
|---|---|---|
| POST | `/api/v1/ledger/initialize` | Inicializa el ledger del usuario: fija moneda de presentación y timezone, y crea las cuentas técnicas de sistema. `201 CommandAccepted`. |
| GET | `/api/v1/ledger/settings` | Lee la proyección de settings del usuario (lectura pura; las mutaciones son EP-4). |
| POST | `/api/v1/accounts` | Abre una cuenta contable. `201 CommandAccepted`; la cuenta es visible en el `GET` inmediato. |
| GET | `/api/v1/accounts` | Lista las cuentas del usuario, ordenadas por nombre (siempre plana). |
| GET | `/api/v1/accounts/{id}` | Devuelve una cuenta; `200` con cuerpo `null` si no existe o no es del usuario. |
| GET | `/api/v1/accounts/{id}/balance` | Saldos confirmado y pendiente por moneda de la cuenta. |
| POST | `/api/v1/accounts/{id}/rename` | Renombra la cuenta y re-prefija su descendencia en la proyección. `200 CommandAccepted`. |
| POST | `/api/v1/accounts/{id}/close` | Cierra la cuenta (transición event-sourced). `200 CommandAccepted`. |

> Schemas, headers (`X-External-Ref`, `X-Ledger-Stream-Position`) y códigos de error
> completos: [`apps/ledger/docs/accounts/api.yaml`](../../../apps/ledger/docs/accounts/api.yaml).

## Modelado de datos

No aplica: la HU no crea ni modifica ninguna tabla ni proyección. Consume `proj_accounts`,
`proj_balances` y `proj_ledger_settings` tal como las dejaron HU-0004/HU-0006 y la
inicialización del ledger.

## Validación de Quality Gates

Evaluados sobre el código as-built (constitución: `docs/rules.md`).

| Gate | Resultado | Justificación |
|---|---|---|
| Simplicity | ✅ | Cero capas nuevas: dos controllers y DTOs de forma sobre buses ya existentes; `AccountsHttpModule` no declara providers propios. |
| Anti-Abstraction | ✅ | NestJS directo (`@Controller`, `ValidationPipe`, `@UseInterceptors`) y los buses del kernel; sin wrappers ni servicios de aplicación intermedios. |
| Integration-First | ✅ | El contrato del módulo (`api.yaml`) está publicado y reconciliado contra el runtime, con los 8 endpoints y sus headers. |
| Test-First | ✅ | Suite completa presente y verde: 3 suites / 15 tests (`accounts.controller.spec.ts`, `ledger.controller.spec.ts`, `accounts-api.e2e.spec.ts`), incluyendo 401 sin contexto, `201` + stream position en initialize, read-your-writes, `409 NAME_COLLISION` y `409 SYSTEM_ACCOUNT_PROTECTED`. Al ser una HU as-built, el gate se verifica por cobertura existente, no por orden de escritura. |

## Riesgos conocidos / observaciones

- **Divergencia Swagger vs runtime (AC-10, aceptada y documentada):** los `@ApiOkResponse`
  publican `camelCase` (`AccountDto`, `LedgerSettingsDto`) mientras el runtime devuelve la
  fila en `snake_case`. El `api.yaml` ya describe la forma real; los decoradores del código
  siguen apuntando a los DTOs. Unificarlos requiere un mapper explícito o proyecciones en
  `camelCase` — HU aparte.
- **`AccountTreeDto` no describe la respuesta de `GET /accounts`:** el DTO declara
  `{ view, accounts[] }` pero el handler devuelve un array plano de filas. Es el caso más
  visible de la divergencia anterior.
- **`npx likec4 validate` reporta 1 error preexistente:** *layout drift* en la view
  `accountsComponents` (`apps/ledger/docs/accounts/accounts.c4`), ya registrado como riesgo
  conocido en el design de HU-0011. No bloquea; se resuelve regenerando el layout.
- **`apps/ledger/docs/accounts/README.md` quedó fuera de la reconciliación:** su tabla de
  casos de uso no lista «Inicializar ledger» ni «Consultar settings», y la fila «Consultar
  cuenta» aún dice *(read-side)* en vez de enlazar `flows/get-account-by-id.md`. Gap menor
  (D-10 del `context.md`), pendiente y no bloqueante.
- **`ACCOUNT_NOT_FOUND` sigue en el catálogo RF-14** aunque `GET /accounts/{id}` no lo emite:
  lo emiten los handlers de escritura al cargar una cuenta inexistente.
