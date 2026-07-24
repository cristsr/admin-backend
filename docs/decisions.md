# Decisiones de Diseño — admin-back

> Log acumulativo de decisiones significativas de diseño, tomadas literalmente
> de la sección "Decisiones de Diseño" de cada historia que las generó (no
> solo las cross-cutting — también decisiones de un solo módulo). Lo mantiene
> `/sync` automáticamente al cerrar cada historia. Append-only: las entradas
> nunca se editan ni se borran; una decisión obsoleta se supersede con una
> entrada nueva que la referencia. Orden cronológico inverso (más reciente
> primero).

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
