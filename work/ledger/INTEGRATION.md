# Integración EP-1 + EP-2 + EP-3 — mapa de reconciliación

Rama: `feat/ledger-integration` (merge de las 3 ramas de worktree hecho;
1 conflicto trivial resuelto en `transactions/.../http/index.ts`).

Las tres épicas compilan y pasan tests **en aislamiento**, pero EP-2 y EP-3
codificaron contra contratos **asumidos** de EP-1. La integración no es repunte de
imports: hay **desajustes estructurales** que exigen adaptar call-sites.

## Archivos de contratos asumidos a eliminar

- `apps/ledger/src/shared/domain/ep1-contracts.assumed.ts` (EP-2: enums + excepciones)
- `apps/ledger/src/shared/application/ep1-contracts.assumed.ts` (EP-2: buses + `CommandResult` + `AssumedEp1BusModule`)
- `apps/ledger/src/accounts/application/ep1-contracts.assumed.ts` (EP-2: commands/queries de cuentas)
- `apps/ledger/src/transactions/application/ep1-contracts.assumed.ts` (EP-2: commands/queries de transacciones)
- `apps/ledger/src/shared/ep1-ep2-contracts.assumed.ts` (EP-3: envelope, buses, event store, commands, VOs, read ports)

## Deltas estructurales (asumido → real)

| Concepto | Asumido (EP-2/EP-3) | Real (EP-1) | Acción |
|---|---|---|---|
| **CommandBus** | `dispatch(cmd)` / `execute(cmd)` con contexto **dentro** del command | `dispatch(command: Command, ctx: AuthContext)` — contexto **separado**; commands extienden `Command` con `commandType` | Adaptar todo call-site: pasar `ctx` aparte; los commands reales ya existen |
| **AuthContext** | `AuthenticatedContext {userId, clientId}` (EP-3) / campos en `LedgerCommand` (EP-2) | `type AuthContext {userId, clientId, externalRef}` | Reemplazar por `AuthContext`; el `externalRef` viaja en el ctx |
| **CommandResult** | EP-2 `{aggregateId, sequence, streamPosition:number, idempotentReplay}`; EP-3 `{aggregateId, streamPosition}` | `{aggregateId, streamPosition: bigint, idempotentReplay}` — **sin `sequence`**, `bigint` | Ajustar `CommandResultInterceptor`/`CommandAcceptedDto` de EP-2: quitar `sequence`, serializar `bigint`→string |
| **DomainEvent** | EP-3: clase concreta **con envelope** (`type`, `aggregateId`, `payload`, `.context`) | Abstracto: `eventType`/`schemaVersion`/`toPayload()`; el envelope vive en `EventEnvelope`/`StoredEvent` | Reescribir reactor/projectors de EP-3 para leer `StoredEvent` (envelope) en vez del `DomainEvent`-con-envelope |
| **EventStore** | EP-3: `append(aggregateId, v, DomainEvent[])`, `load→DomainEvent[]`, `readAll→PositionedEvent[]` | `append(stream: StreamId, v, EventEnvelope[])`, `load→StoredEvent[]`, `readAll(pos: bigint, limit)→StoredEvent[]`, `findByExternalRef` | Repuntar a puerto real; adaptar el in-memory double y las repos de EP-3 |
| **PostingLine** | EP-3: `new PostingLine(accountId, amount)` + `toInput()` | `PostingLine.of({accountId, amount, metadata})` (ctor privado) + `negated()`, `currencyCode` | Repuntar construcción en `AdjustmentFactory` de EP-3 |
| **LedgerDate** | EP-3: `LocalDate.of(iso)` con `isOnOrBefore/isOnOrAfter` | `LedgerDate.of(raw)` con `isSameOrBefore/isSameOrAfter`, `value` | Renombrar tipo + métodos en el evaluador de aserciones |
| **Commands txn** | EP-3 asume `RecordTransaction/Confirm/VoidPending` (ctor con context) | Reales en `transactions/application/*/**.command.ts` (extienden `Command`) | Repuntar `ResolveDiscrepancy`/`MergePendingTransfers`; **nota**: el `MergePendingTransfers` real ya existe en EP-1 (`transactions/application/commands/`) |
| **Excepciones/códigos** | EP-2 `ledger-error-code.ts` + excepciones asumidas; EP-3 `LedgerConcurrencyException` | Excepciones reales **ya cargan los mismos códigos string** (`CONCURRENCY_CONFLICT`, etc.) | Mantener `ledger-error-code.ts` (EP-2) como fuente API; repuntar consumidores a las excepciones reales de EP-1; borrar `LedgerConcurrencyException` asumida |
| **Enums** | EP-2/EP-3 `AccountType`/`TransactionStatus`/`DerivedKind` | Reales en dominio de `accounts`/`transactions` | Repuntar imports a los reales; borrar duplicados |
| **Buses tokens** | `CommandBus`/`QueryBus` abstractos asumidos | `CommandBus`(=`PolicyCommandBus`)/`QueryBus` reales en `shared-kernel/application` | Repuntar DI de EP-2/EP-3; quitar `AssumedEp1BusModule` de `app.module.ts` |
| **Read ports EP-3** | `LedgerSettingsReader`, `SystemAccountLookup`, `AccountLookup` | Verificar equivalentes reales o promover a puertos reales del núcleo | Mapear a proyecciones reales de EP-1; `proj_ledger_settings` proyector **falta** (EP-1 no lo hizo) |

## Etapas de ejecución (con commit por etapa)

1. **Vocabulario compartido**: unificar enums + excepciones + `AuthContext` + `CommandResult`. Borrar `shared/domain/ep1-contracts.assumed.ts` y `shared/application/ep1-contracts.assumed.ts`; repuntar a real. Ajustar `CommandResultInterceptor`/`CommandAcceptedDto`.
2. **EP-2 → buses/commands reales**: quitar `AssumedEp1BusModule`; controllers dispatch `(Command, ctx)`; repuntar commands/queries de `accounts`/`transactions` a los reales; montar módulos HTTP en `AppModule`.
3. **EP-3 → núcleo real**: repuntar `EventStore`/`StoredEvent`/envelope en reactor+projectors; `PostingLine.of`; `LedgerDate`; commands reales; read ports; borrar `shared/ep1-ep2-contracts.assumed.ts`.
4. **Faltantes**: proyector `proj_ledger_settings`; adaptador Postgres de `ReadModelStore` (EP-1 lo dejó para integración); montar `Reconciliation`/`Transactions` modules en `AppModule`.
5. **Decisión de diseño abierta**: atomicidad cross-stream de commands multi-agregado (`InitializeLedger`, `Reverse`, `MergePendingTransfers`, `ResolveDiscrepancy`). EP-1 dejó append por-stream (no atómico cross-agregado) — aceptable en fase dev, o adaptador de transacción compartida. **Requiere confirmación.**
6. **Verde total**: `nx build ledger` + `nx lint ledger` + `nx test ledger` en un solo árbol; e2e con dominio real (EP-2 usaba buses mockeados).
