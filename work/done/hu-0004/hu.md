# hu-0004: `ReadModelStore` + `ProjectionDispatcher` + proyector `account_tree`

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** el puerto de escritura de read models (`ReadModelStore`), la base `Projector`, el
`ProjectionDispatcher` con sus dos modos (síncrono en la transacción del command, y
asíncrono con checkpoint) usando el **mismo código de proyector**, y el proyector
`account_tree` (con el derivador `TransactionKindDeriver`)
**Para** tener la superficie de lectura de cuentas lista **antes** de cerrar los command
handlers (`hu-0005`), que la necesitan para validar posting↔cuenta contra `account_tree`
(§3.5)

> Corresponde a **EP-1.9 + una porción de EP-1.10** (proyector `account_tree` y
> `TransactionKindDeriver` únicamente) del [roadmap del ledger](../../../ledger-roadmap.md),
> en el orden del Apéndice B de `work/ledger/EP-1-nucleo.md` (paso 4: proyecciones antes del
> command bus). El resto de EP-1.10 (`transaction_list`, `proj_postings`,
> `account_balances`) queda en `hu-0006`. Detalle técnico: `work/ledger/EP-1-nucleo.md`
> (secciones EP-1.9 y EP-1.10). Depende de `hu-0002` (`EventStore`, `StoredEvent`) y `hu-0003`
> (eventos `AccountOpened`/`Renamed`/`Closed`).

## Criterios de Aceptación

### AC-1: `ReadModelStore` es el único puerto de escritura de proyecciones (RNF-10)

`ReadModelStore` declara `upsert(table, key, row)`, `delete(table, key)`, `query<TRow>(table,
criteria)` (reutiliza `Criteria` de `@shared`) y `truncate(table)` (para rebuild, RNF-5).
Ningún otro componente del sistema escribe read models fuera de un `Projector`.

### AC-2: `Projector` es agnóstico del modo de ejecución

`Projector` declara `name`, `consumes` (lista de `event_type`) y `project(event, store)`. La
**misma instancia** de projector corre sin cambios en modo síncrono o asíncrono — el modo es
configuración del dispatcher, nunca una bifurcación dentro del código del projector (§3.8).

### AC-3: `SynchronousDispatcher` proyecta en la transacción del command (RNF-9)

El dispatcher síncrono ejecuta el projector dentro de la misma unidad de trabajo que el
append del command: si el projector falla, la transacción completa (evento + proyección)
revierte. Esto habilita lectura de las propias escrituras (read-your-writes) para las vistas
críticas.

### AC-4: `PollingDispatcher` avanza checkpoint sin duplicar

El dispatcher asíncrono procesa eventos desde el último checkpoint (`ProjectionCheckpointRepository.lastPosition`),
proyecta y avanza el checkpoint (`advance`). Reprocesar desde un checkpoint no avanzado no
duplica filas (el `upsert` es idempotente por clave).

### AC-5: Un mismo projector produce el mismo resultado en ambos modos

Un projector de prueba, corrido primero síncrono y luego por poller sobre el mismo stream de
eventos, produce exactamente el mismo estado final en el `ReadModelStore`.

### AC-6: El `account_tree` refleja apertura, cierre y propaga el renombre a descendientes

El proyector `account_tree` consume `AccountOpened`/`AccountRenamed`/`AccountClosed`. Ante
`AccountOpened` crea la fila de la cuenta; ante `AccountClosed` marca `closed_on`. Ante
`AccountRenamed`, actualiza el nombre de la cuenta renombrada **y el prefijo de todas sus
cuentas descendientes** (§6.3) — esta es la única proyección afectada por la propagación de
un renombre (el agregado `Account`, en `hu-0003`, solo renombra su propio nombre).

### AC-7: `TransactionKindDeriver` deriva el tipo presentacional sin lanzar nunca (RF-4)

Dado el conjunto de tipos de cuenta (`AccountType`) tocados por los postings de una
transacción, `TransactionKindDeriver.derive(accountTypes)` devuelve: `EXPENSE` si hay alguna
cuenta `EXPENSES`; si no, `INCOME` si hay alguna `INCOME`; si no, `TRANSFER` si todas son
`ASSETS`/`LIABILITIES`; en cualquier otra combinación, `COMPOUND`. La función **nunca lanza**
— cualquier combinación no contemplada cae en `COMPOUND` (§9.4.4).

## Reglas de Negocio

- INV-5: los saldos y demás vistas de lectura son siempre proyección — ningún command escribe
  directamente en un read model.
- La propagación de renombre a descendientes vive **solo** en la proyección `account_tree`,
  nunca en el agregado `Account` (decisión ya registrada en `hu-0003`).
- `COMPOUND` es un resultado válido de negocio, nunca un error (RF-4).
- `application/` (lógica de projectors) libre de NestJS/TypeORM; NestJS solo en los adaptadores
  concretos (`infrastructure/`) del dispatcher síncrono/asíncrono.
- TDD estricto, incluyendo contract tests para `ReadModelStore` (mismo patrón que
  `EventStore` en `hu-0002`: una sola suite reutilizable entre in-memory y Postgres).

## Fuera de Alcance

- El adaptador Postgres de `ReadModelStore` — se re-ejecuta la misma suite contra Postgres en
  `hu-0007` (junto con `PostgresEventStore`, EP-1.5).
- Los proyectores `transaction_list`/`proj_postings` y `account_balances` — `hu-0006` (resto
  de EP-1.10).
- El command bus y los handlers que consumen `account_tree` para validación cruzada —
  `hu-0005` (EP-1.8).
- El query bus y sus handlers — `hu-0006` (EP-1.11).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `Criteria` — de `@shared`, reutilizado por `ReadModelStore.query`
- `StoredEvent`, `EventStore` — de `hu-0001`/`hu-0002`
- `AccountOpened`/`AccountRenamed`/`AccountClosed`, `AccountType` — de `hu-0003`
- Patrón `@Cron` + `claimPendingBatch` del outbox de `finances`
  (`apps/finances/.../outbox-relay.scheduler.ts:23`) como referencia para el `PollingDispatcher`

### Patrones obligatorios
- `application/` (projectors, dispatcher como puerto) libre de NestJS/TypeORM; NestJS solo en
  `infrastructure/`
- Contract tests parametrizados para `ReadModelStore` (mismo patrón que `hu-0002`)
- TDD estricto

### Restricciones técnicas
- El modo síncrono/asíncrono es configuración por proyección, nunca una bifurcación dentro
  del código del `Projector`
- El poller debe evitar reentrancia entre ticks solapados (mitigación prevista:
  `FOR UPDATE SKIP LOCKED` / checkpoint por proyección — se resuelve en el adaptador Postgres,
  `hu-0007`; el adaptador in-memory de este alcance no enfrenta concurrencia real)

### Deuda técnica relevante
- Ninguna — depende de `hu-0002`/`hu-0003` ya construidas en este mismo flujo
