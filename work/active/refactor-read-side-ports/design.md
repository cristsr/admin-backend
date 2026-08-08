# design: refactor-read-side-ports

> **El diseño completo vive en [`docs/proposals/read-side-ports.md`](../../../docs/proposals/read-side-ports.md)**
> y es la fuente de verdad de esta refactorización: diagnóstico con evidencia (§1),
> decisión y alternativas descartadas (§2), las 8 reglas de diseño (§3), el inventario
> de los 10 puertos con sus firmas (§4), cambios de esquema (§5), composición (§6),
> testing (§7) y plan de fases (§9). Este archivo sólo aporta lo que el pipeline SDD
> necesita y que el proposal no tiene en su formato.

## Flujo entre microservicios

Ninguno. La refactorización es interna a `apps/ledger` y no cambia ningún contrato
HTTP ni introduce integración nueva.

## Componentes del módulo

10 puertos nuevos (`abstract class` en `application/ports/`) con su adaptador en
`infrastructure/adapters/persistence/`, más un archivo de esquema por proyección en
`infrastructure/projections/*.schema.ts`.

| Módulo | Puertos | Adapter SQL |
|---|---|---|
| `accounts` | `AccountTreeFinder`, `AccountConstraintsReader`, `AccountNameReader`, `AccountBalanceFinder` | — |
| `transactions` | `TransactionFinder`, `PendingReviewFinder` | `TransactionFinder` |
| `ledger` | `LedgerSettingsFinder`, `LedgerTimezoneReader`, `SystemAccountLookup` | — |
| `reference` | `CurrencyCatalogFinder` | — |

Se eliminan: `reconciliation/application/ports/ledger-settings-reader.port.ts` y
`system-account-lookup.port.ts` (reubicados en `ledger`). Se renombran:
`AssertionStatusStore` → `AssertionStatusReader`, `AdjustmentAuditStore` →
`AdjustmentAuditReader`, `AssertionStatusRow` → `AssertionStatusRecord`.

Firmas completas en §4 del proposal.

## Flujos afectados

| Operación | Slug | Trigger | Entrypoint |
|---|---|---|---|
| modify | `query-dispatch` | rest | GET /api/v1/* |

Los flujos de comando no cambian de forma observable, pero tres de ellos dejan de
tocar el read model directo: `open-account` y `rename-account` (vía
`AccountNameReader`) y `record-opening-balance` (vía `SystemAccountLookup`).

## Impacto en Arquitectura Global

**No.** No hay app, microservicio, integración externa ni actor nuevo. Los cambios son
de C4 Nivel 3 (componentes dentro de módulos existentes) y los absorbe cada
`apps/ledger/docs/<módulo>/*.c4`. `/architecture` no debe invocarse.

## Decisiones de Diseño

### Los read models no se modelan como entidades de dominio

Se evaluó darle a cada proyección una entidad de dominio con su repositorio,
implementado por TypeORM en infraestructura. Se descartó: en event sourcing el dominio
ya son los agregados que se rehidratan del event store, y un read model es un artefacto
derivado y desechable —se trunca y se reconstruye—, sin invariantes propios. Modelarlo
como entidad crea una segunda representación del mismo concepto, invita a un `save()`
que violaría el Artículo 10, y le impone a un artefacto que *debe* cambiar de forma
cuando cambia una query la rigidez de algo que no debe cambiar. El riesgo no es teórico:
`AccountValidationService` ya aplica reglas de dominio sobre filas de proyección, y hoy
lo hace con *una* implementación de la regla y dos fuentes de estado; una entidad de
lectura sería el lugar natural para duplicarla (Art. 12).

Lo que sí se adopta es la otra mitad de la idea: un **puerto de lectura tipado por
consumidor**, que es el patrón que `reconciliation` ya usaba (`AssertionStatusStore`,
`AdjustmentAuditStore`) y que los otros cuatro módulos no habían adoptado.

### Sin entidades TypeORM para las proyecciones

Las migraciones están escritas a mano, `synchronize` nunca estará en `true` y los
projectors escriben por `upsert` genérico: diez clases decoradas comprarían un tipado
que un `type XRow` ya da (Anti-Abstraction Gate). Los adapters que necesitan más que
`Criteria` usan `DataSource`/`QueryBuilder` directo, y de los diez puertos sólo uno lo
necesita.

### El sufijo del puerto es normativo

`Finder` sirve a la API y devuelve un `View`; `Reader`/`Lookup` sirven al write side y
devuelven un tipo propio del puerto; `Repository` queda reservado para agregados
event-sourced. Es una afirmación verificable en review: un `Finder` consumido por un
command handler es un corte mal hecho.

### El esquema de una proyección se declara una sola vez

`PROJ_*` y el `*Row` completo viven junto a su projector, en `infrastructure`. Todos los
adapters —propios y de otros módulos— importan de ahí. Antes había tres declaraciones
parciales de `AccountRow` y dos de `PostingRow`, ninguna de las cuales describía la
tabla real.

### `proj_balances` gana `user_id`

La tabla no tenía dueño, lo que obligaba a reconstruir la pertenencia cruzando contra
`proj_accounts` en memoria —trayendo antes los balances de todos los usuarios—. Es la
causa del roce con el Artículo 5 y la razón por la que el read side necesitaba tres
adapters SQL; con la columna, necesita uno.
