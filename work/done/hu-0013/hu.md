# hu-0013: Endpoints de cuentas — `/ledger/initialize`, `/accounts`

## Historia de Usuario

**Como** cliente autenticado del ledger
**Quiero** inicializar mi ledger y gestionar el ciclo de vida de mis cuentas (abrir, renombrar,
cerrar) y consultar el árbol de cuentas y sus saldos vía HTTP
**Para** administrar mi plan de cuentas de partida doble desde el frontend, con read-your-writes
y errores de dominio con código estable

> Corresponde a **EP-2.4** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-2-api.md` (sección EP-2.4). Depende del agregado `Account`
> y sus handlers (`hu-0003`/`hu-0005`), las proyecciones `account_tree`/`account_balances`
> (`hu-0004`/`hu-0006`), el andamiaje HTTP (`hu-0009`), el contexto autenticado (`hu-0010`),
> los códigos de error (`hu-0011`) y read-your-writes + idempotencia (`hu-0012`).

## Criterios de Aceptación

### AC-1: Inicialización del ledger

`POST /api/v1/ledger/initialize` con `{ presentationCurrency, timezone }` (+ `external_ref`)
despacha `InitializeLedger`, crea las cuentas técnicas y responde `201` con
`CommandAcceptedDto` (incluyendo `streamPosition`).

### AC-2: Lectura de settings

`GET /api/v1/ledger/settings` responde `200` desde la proyección de settings. Es lectura
pura; las mutaciones quedan fuera de esta HU (EP-4).

**Forma real:** devuelve la fila cruda de la proyección (`LedgerSettingsRow`, en
`snake_case`: `presentation_currency`, …), no un `LedgerSettingsDto`. Ver AC-10.

### AC-3: Apertura de cuenta y read-your-writes

`POST /api/v1/accounts` con `{ type, name, parentId?, currencies[], openedOn, isBankMirror }`
(+ `external_ref`) despacha `OpenAccount` y responde `201`. La cuenta recién creada aparece en
el `GET /api/v1/accounts` inmediato (read-your-writes).

**`type` y `parentId` se validan pero no se transportan.** El controller construye
`new OpenAccountCommand(dto.name, dto.currencies, dto.openedOn, dto.isBankMirror)`: el
agregado `Account` deriva el tipo y el padre del **nombre jerárquico**
(`Assets:Bancolombia:Savings` → tipo `ASSETS`, padre `Assets:Bancolombia`). Los dos campos
siguen en el DTO como malla de validación de forma, pero el nombre es la autoridad; si
`type` contradice el prefijo del nombre, gana el nombre y el `type` enviado se ignora en
silencio.

### AC-4: Consulta de árbol y de cuenta

`GET /api/v1/accounts` responde `200` acotado al `user_id` del contexto. `GET
/api/v1/accounts/{id}` responde `200` con una sola cuenta.

**`?view=tree|flat` se acepta y se ignora.** El parámetro se valida vía
`AccountTreeQueryDto` pero el controller lo recibe como `_query` y nunca lo pasa al query
bus: la respuesta es **siempre la lista plana** ordenada por nombre. El shaping jerárquico
está pendiente — hay un `TODO(read-shape)` en `account-tree-view.ts`. El cliente puede
reconstruir el árbol desde el nombre jerárquico.

**`GET /accounts/{id}` inexistente responde `200` con cuerpo `null`,** no `404
ACCOUNT_NOT_FOUND`: el handler hace `return row ?? null` y ninguna capa traduce el `null` a
excepción. `ACCOUNT_NOT_FOUND` existe en el catálogo RF-14 pero no lo emite esta ruta.

### AC-5: Saldos por moneda

`GET /api/v1/accounts/{id}/balance` responde `200` con los saldos (confirmado/pendiente) por
moneda, servidos por la proyección `account_balances`. El balance nunca se escribe (INV-5):
es solo proyección.

**`?currency` se acepta y se ignora** (`AccountBalanceQueryDto` llega como `_query`): la
respuesta siempre trae todas las monedas de la cuenta. Filtrar por moneda queda del lado del
cliente.

### AC-10: El read-side devuelve filas de proyección, no DTOs

Las cuatro lecturas (`GET /accounts`, `GET /accounts/{id}`, `GET /accounts/{id}/balance`,
`GET /ledger/settings`) devuelven **la fila de la proyección tal cual**, en `snake_case`
(`account_id`, `currency_code`, `confirmed_amount`, `pending_amount`,
`presentation_currency`). Los `AccountDto`/`AccountTreeDto`/`AccountBalanceDto`/
`LedgerSettingsDto` existen y decoran Swagger vía `@ApiOkResponse`, pero **no se
construyen en runtime**: el controller hace `queryBus.ask<AccountDto>(...)`, un genérico
sin verificación que no transforma nada.

Consecuencia: el contrato publicado en Swagger y la respuesta real difieren en el naming de
los campos. Se documenta el estado actual; unificarlos (mapper explícito en el controller o
proyecciones en `camelCase`) es trabajo de otra HU.

### AC-6: Renombrar y cerrar como acciones POST

`POST /api/v1/accounts/{id}/rename` con `{ newName }` despacha `RenameAccount`; `POST
/api/v1/accounts/{id}/close` con `{ closedOn }` despacha `CloseAccount`. Ambos responden `200
CommandAcceptedDto`. Se modelan como sub-recursos POST de acción (transiciones de ciclo de vida
event-sourced), no como `PATCH`/`DELETE`.

### AC-7: Errores de dominio con código estable

- `POST /accounts` con nombre duplicado → `409 NAME_COLLISION`.
- `POST /accounts/{systemId}/close` de una cuenta de sistema → `409 SYSTEM_ACCOUNT_PROTECTED`.
- `ACCOUNT_CLOSED` y `CURRENCY_NOT_ALLOWED` son **`422`, no `409`** — status congelado por
  la decisión de `hu-0011` (violación semántica del payload que el cliente corrige eligiendo
  otra cuenta o moneda). Manda el catálogo RF-14.
- Ninguno de esos dos códigos es alcanzable **desde los endpoints de cuentas**: se emiten al
  registrar postings contra una cuenta cerrada o con moneda no permitida, que es una ruta de
  `/transactions` (`hu-0014`). Abrir una cuenta bajo un padre cerrado no está validado por
  esta ruta.

### AC-8: Idempotencia por `external_ref`

`POST /accounts` reenviado con el mismo `external_ref` devuelve el resultado original
(idempotente), sin abrir una cuenta nueva.

### AC-9: El DTO valida solo forma, no dominio

Los request DTO validan tipos, formato y presencia (class-validator + Swagger) — nunca reglas
de dominio (jerarquía, colisión de nombre, mono-moneda de cuentas reales, protección de
cuentas de sistema): esas las verifican los agregados de EP-1.

## Reglas de Negocio

- Toda ruta exige contexto autenticado (`hu-0010`); las consultas se acotan al `user_id`.
- El balance es siempre proyección de solo lectura (INV-5).
- `rename`/`close` son transiciones event-sourced, no CRUD → POST de acción.
- `GET /ledger/settings` es lectura pura; `ChangePresentationCurrency`/`ChangeTimezone`
  pertenecen a EP-4.1 y se omiten.
- Montos y fechas: fechas contables planas sin zona (`IsDateString`, RNF-7).
- Read-your-writes garantizado por proyección síncrona (`hu-0012`).
- TDD estricto (controller con buses mockeados + e2e con in-memory EventStore y proyecciones
  síncronas).

## Fuera de Alcance

- Mutaciones de settings del ledger (`ChangePresentationCurrency`, `ChangeTimezone`) → EP-4.
- Cualquier recurso de transacciones (`hu-0014`).
- Transferencias, balance assertions, monedas, precios, presupuestos, metas, reportes → EP-3/EP-4.

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- Agregado `Account` + handlers `InitializeLedger`/`OpenAccount`/`RenameAccount`/`CloseAccount`
  — de `hu-0003`/`hu-0005`.
- Proyecciones `account_tree`, `account_balances` + query bus — de `hu-0004`/`hu-0006`.
- `CommandAcceptedDto`, patrón controller→bus, `@Context()`, `@ExternalRef()` — de
  `hu-0009`/`hu-0010`/`hu-0012`.
- Exception filter + códigos estables — de `hu-0011`.

### Artefactos a crear
- `apps/ledger/src/accounts/infrastructure/adapters/http/accounts.controller.ts`
- `apps/ledger/src/accounts/infrastructure/adapters/http/ledger.controller.ts` (initialize +
  settings-read)
- DTOs de request/response en `.../http/dto/`: `initialize-ledger-request`,
  `open-account-request`, `rename-account-request`, `close-account-request`,
  `account-tree-query` (`view: tree|flat`), `account`, `account-tree`, `account-balance`,
  `ledger-settings` (+ `index.ts`).
- `.../http/index.ts`.

### Patrones obligatorios
- Controller → command/query bus, sin lógica de dominio (RNF-10).
- Escritura → `CommandAcceptedDto`; nunca una vista.
- DTO valida solo forma (class-validator + `@Api*`).
- TDD estricto.

### Restricciones técnicas
- El controller no arma criteria ni SQL; delega al query bus.
- El balance nunca se escribe.
