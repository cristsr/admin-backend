# hu-0006: Proyectores `transaction_list`/`account_balances` + query bus

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** los proyectores `transaction_list` (+ `proj_postings`) y `account_balances`, junto
con el query bus y sus handlers (`get-account-tree`, `get-account-balance`,
`list-transactions`)
**Para** poder consultar el estado completo del ledger (árbol de cuentas, saldos, listado de
transacciones filtrable) desde las proyecciones, cerrando el lado de lectura de EP-1 antes de
exponerlo por HTTP (EP-2)

> Corresponde al **resto de EP-1.10** (`transaction_list`, `proj_postings`,
> `account_balances`) **+ EP-1.11** (query bus) del
> [roadmap del ledger](../../../ledger-roadmap.md), paso 6-7 del Apéndice B de
> `work/ledger/EP-1-nucleo.md`. Detalle técnico: `work/ledger/EP-1-nucleo.md` (resto de la
> sección EP-1.10 y sección EP-1.11). Depende de `hu-0003` (eventos de `LedgerTransaction`),
> `hu-0004` (`ReadModelStore`, `Projector`, proyección `account_tree`) y `hu-0005` (handlers
> que producen los eventos a proyectar).

## Criterios de Aceptación

### AC-1: `transaction_list` refleja todo el ciclo de vida de la transacción

El proyector consume `TransactionRecorded`/`Amended`/`Annotated`/`Confirmed`/`Voided`/
`Reversed` (+ `TransfersMerged`, cuando exista) y escribe `proj_transactions`
(desnormalizada: estado, payee, `derived_kind`, `reverses_id`) y `proj_postings` (una fila
por posting, con su cuenta, monto y moneda). El estado y los postings reflejan exactamente el
último evento aplicado.

### AC-2: `derived_kind` se deriva contra `account_tree`, nunca falla

Al proyectar una transacción, el proyector obtiene los tipos de cuenta de los postings desde
`account_tree` (`hu-0004`) y usa `TransactionKindDeriver` para calcular `derived_kind`. Si una
cuenta referenciada aún no aparece en `account_tree` (desfase temporal entre proyecciones), el
resultado cae en `COMPOUND` como valor temporal, reconciliable en un rebuild posterior — nunca
lanza ni bloquea el dispatch.

### AC-3: `account_balances` distingue confirmado de pendiente por cuenta y moneda

El proyector consume `TransactionConfirmed`/`Reversed`/`Voided` (y las pendientes por
separado) y mantiene `confirmed_amount` y `pending_amount` por cuenta y por moneda,
en filas separadas cuando la transacción es multi-moneda. Una reversa netea el saldo
confirmado de la transacción original y su reversa vinculada.

### AC-4: Replay del mismo stream produce el mismo estado (enlaza con `hu-0008`)

Proyectar el mismo stream de eventos dos veces (rebuild completo) produce exactamente el
mismo estado final en `proj_transactions`, `proj_postings` y `proj_balances` — la
idempotencia por clave del `upsert` (`hu-0004`) lo garantiza.

### AC-5: El query bus expone solo lectura, sin efectos ni acceso al event store (RNF-10)

`QueryHandler.execute(query, ctx)` lee exclusivamente de `ReadModelStore`; ningún query
handler escribe, ni accede al `EventStore`, ni produce efectos secundarios.

### AC-6: `list-transactions` filtra y pagina sobre `Criteria` (RF-13)

`ListTransactionsQuery` acepta filtros combinables por cuenta, período, estado, `derived_kind`,
**payee** y `client_id`, con paginación, construidos como un `Criteria<TransactionField>`
(mismo patrón que `apps/finances/.../movement-listing.criteria.ts`).

### AC-7: `get-account-tree` y `get-account-balance` exponen el árbol y el saldo

`get-account-tree` devuelve el árbol de cuentas (o su forma plana) desde `account_tree`.
`get-account-balance` devuelve el saldo confirmado y pendiente por moneda de una cuenta desde
`account_balances`.

### AC-8: Toda query está anclada al usuario del contexto (INV-9)

Ningún filtro ni resultado de ninguna de las tres queries puede cruzar datos de otro usuario:
el `userId` del `AuthContext` se aplica siempre, no es un filtro opcional.

## Reglas de Negocio

- INV-5: `account_balances` es el único productor de saldos — ningún command los escribe
  directamente.
- `COMPOUND` como resultado temporal ante desfase `transaction_list`↔`account_tree` no es un
  error — se reconcilia en rebuild (`hu-0008`).
- Los query handlers son de solo lectura (RNF-10): ninguno invoca `EventStore` ni
  `ReadModelStore.upsert`/`delete`.
- `application/` (projectors y query handlers) libre de NestJS/TypeORM.
- TDD estricto, incluyendo el caso de replay/rebuild que enlaza con `hu-0008`.

## Fuera de Alcance

- El adaptador Postgres de `ReadModelStore` y de `EventStore` — `hu-0007` (EP-1.5).
- El tooling de rebuild/replay y el verificador de consistencia stream↔proyección —
  `hu-0008` (EP-1.12).
- Los endpoints HTTP que exponen estas queries — EP-2.

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `Projector`, `ReadModelStore`, `TransactionKindDeriver`, proyección `account_tree` — de
  `hu-0004`
- Eventos de `LedgerTransaction` (`TransactionRecorded`/`Amended`/`Annotated`/`Confirmed`/
  `Voided`/`Reversed`) — de `hu-0003`
- `Criteria` de `@shared` y el patrón de
  `apps/finances/src/movement/domain/movement/criteria/movement-listing.criteria.ts` para las
  queries filtradas

### Patrones obligatorios
- `application/` libre de NestJS/TypeORM
- Query handlers sin efectos secundarios (RNF-10)
- Criteria por proyección siguiendo el patrón ya usado en `finances`
- TDD estricto

### Restricciones técnicas
- `derived_kind` nunca lanza ante datos de cuenta ausentes — cae en `COMPOUND` temporal
- Ninguna query cruza usuarios (INV-9)

### Deuda técnica relevante
- Ninguna — depende de `hu-0003`/`hu-0004`/`hu-0005` ya construidas en este mismo flujo
