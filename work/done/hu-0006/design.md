# design: hu-0006

## Decisiones de Diseño

No hubo incógnitas que resolver — el código ya existe. El design documenta la
arquitectura tal como está implementada, verificando contra los AC de la HU.

## Flujo entre componentes

Esta historia no introduce integraciones entre apps — todo es interno a `apps/ledger`.
Los proyectores reaccionan a eventos de dominio via `SynchronousProjectionDispatcher` y
escriben en el `ReadModelStore`. El `QueryBus` (`RegistryQueryBus`) rutea queries a sus
handlers, que leen exclusivamente del `ReadModelStore`. Ambos buses se cablean en
`createLedgerApplication()` (write side) y `createQueryBus()` (read side), y se exponen
en NestJS via `LedgerCoreModule`.

> Diagrama completo de componentes y flujos: [`docs/model.delta.c4`](./docs/model.delta.c4).
> Flujos documentados: [`docs/flows/`](./docs/flows/).

## Componentes nuevos

| Capa | Componente | Archivo |
|---|---|---|
| Application | `Query` (abstract) | `shared-kernel/application/query-bus/query.ts` |
| Application | `QueryHandler<TQuery, TResult>` (abstract) | `shared-kernel/application/query-bus/query-handler.ts` |
| Application | `QueryBus` (abstract) / `RegistryQueryBus` (concrete) | `shared-kernel/application/query-bus/query-bus.ts` |
| Application | `QueryContext` (type) | `shared-kernel/application/query-bus/query-handler.ts` |
| Application | `UnregisteredQueryException` | `shared-kernel/application/query-bus/query-bus.ts` |
| Infrastructure | `TransactionListProjector` | `transactions/infrastructure/projections/transaction-list.projector.ts` |
| Infrastructure | `AccountBalancesProjector` | `transactions/infrastructure/projections/account-balances.projector.ts` |
| Read-side | `createQueryBus()` factory | `read-side/query-bus.factory.ts` |
| Read-side | `ListTransactionsHandler` + `ListTransactionsQuery` | `read-side/list-transactions/` |
| Read-side | `GetAccountTreeHandler` + `GetAccountTreeQuery` | `read-side/get-account-tree/` |
| Read-side | `GetAccountBalancesHandler` + `GetAccountBalancesQuery` | `read-side/get-account-balances/` |
| Read-side | `GetTransactionByIdHandler` | `read-side/get-transaction-by-id/` |
| Read-side | `GetAccountByIdHandler` | `read-side/get-account-by-id/` |
| Read-side | `GetLedgerSettingsHandler` | `read-side/get-ledger-settings/` |

## Flujos afectados

| Flujo | Operación | Módulo | Trigger | View |
|---|---|---|---|---|---|
| `project-transaction-list` | create | transactions | domain-event | `projectTransactionList` |
| `project-account-balances` | create | transactions | domain-event | `projectAccountBalances` |
| `list-transactions` | modify | transactions | rest | `listTransactions` |
| `list-accounts` | modify | accounts | rest | `listAccounts` |
| `get-account-balances` | modify | accounts | rest | `getAccountBalances` |

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance es interno al módulo `shared-kernel` y a los módulos `transactions`/`accounts`
de `apps/ledger`. No se agregan apps nuevas, módulos nuevos a nivel container, ni
integraciones externas. Los componentes `QueryBus`, `QueryHandler` y `Query` extienden
el subsistema de buses de `shared-kernel` (junto al `CommandBus` ya documentado), y los
proyectores y query handlers son parte de la infraestructura y read-side de sus módulos
respectivos.

## Contratos

Esta historia no introduce nuevos endpoints HTTP — los endpoints `GET /transactions`,
`GET /accounts` y `GET /accounts/{id}/balance` pertenecen a EP-2 (fuera de alcance).
Los contratos internos (queries y sus DTOs) son código TypeScript, no REST.

No se genera `docs/api.delta.yaml` por no haber paths nuevos ni modificados.

## Modelado de datos

No hay tablas nuevas — `proj_transactions`, `proj_postings` y `proj_balances` ya
existen como tablas lógicas del `ReadModelStore` (schema-on-read, sin entidades
TypeORM).

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|---|---|---|
| Simplicity | ✅ | No se agregan capas nuevas — `QueryBus` sigue el mismo patrón que `CommandBus` ya existente. Los proyectores extienden `Projector` sin nuevas abstracciones. |
| Anti-Abstraction | ✅ | `RegistryQueryBus` es una implementación directa de `QueryBus` abstracto, igual que `PolicyCommandBus` para `CommandBus`. Sin wrappers innecesarios. |
| Integration-First | ✅ | Los contract tests (`query-bus.spec.ts`) ejercitan el bus contra `InMemoryReadModelStore` antes que cualquier adapter HTTP. |
| Test-First | ✅ | El spec `query-bus.spec.ts` existe y cubre los 3 queries principales con datos sembrados via commands. Los proyectores tienen specs individuales (ej. `transaction-list.projector.spec.ts`). |

## Gaps conocidos (documentados, no bloqueantes)

Ver `context.md` para detalle completo. Resumen:

| Gap | Impacto | Acción |
|---|---|---|
| `TransactionReversed` no consumido por proyectores | Reversiones no se reflejan en proyecciones | Corregir en hotfix o HU futura si se requiere |
| `client_id` ausente en `ListTransactionsQuery` | AC-6 no se cumple completamente | Agregar filtro |
| `TransfersMerged` no existe | Evento futuro, esperable | HU dedicada |
| Paginación `limitTo` sin offset | La paginación real necesita `paginate()` | Refinar cuando EP-2 lo requiera |
| `PostgresReadModelStore.upsert` firma inconsistente | Posible bug en ON CONFLICT | Corregir en HU de infraestructura |
| Sin documentación de flows para queries | Este design lo resuelve | Completado con este delta |
| Sin entidades TypeORM para `proj_*` | Por diseño (schema-on-read) | Sin acción |
