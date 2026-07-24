# design: hu-0002

## Decisiones de Diseño

- **AC-11 — Ubicación del guard de lote vacío:** guard en ambos lados — `EventSourcedRepository.save()` retorna early si `pullChanges()` está vacío, **y** `InMemoryEventStore.append()` maneja `events: []` como no-op. Defensa en profundidad: el repositorio nunca llama al store sin cambios, y el store tolera lotes vacíos independientemente del caller.

## Flujo entre microservicios

Flujo interno de `apps/ledger`: un `CommandHandler` llama a `EventSourcedRepository.save()`, que ahora verifica si el agregado tiene cambios pendientes antes de delegar al `EventStore`. Si el agregado no tiene cambios (`pullChanges()` vacío), retorna sin tocar el store. Si delega, `InMemoryEventStore.append()` también tiene ahora un guard temprano para `events: []`. El diagrama completo está en `docs/diagram.md`.

## Componentes del módulo

Esta historia modifica tres componentes internos del módulo `shared-kernel`: agrega un guard de lote vacío en `EventSourcedRepository.save()` (application), un guard equivalente en `InMemoryEventStore.append()` (infrastructure), y un nuevo test case en `describeEventStoreContract()` (testing). El diagrama C4 Nivel 3 acumulativo del módulo completo está en `docs/component.md`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance es completamente interno al módulo `shared-kernel` de `apps/ledger`. No se agregan nuevos microservicios, módulos, integraciones externas ni actores. Los cambios son guards defensivos + un test case adicional sobre componentes ya existentes.

- **Nivel:** N/A
- **Cambio:** Ninguno
- **Nodo/arista concreto:** N/A

## Contratos por microservicio

### apps/ledger

Esta historia no introduce ni modifica endpoints HTTP. El `EventStore` es un puerto interno de dominio, no expuesto como API REST.

> Sin contrato OpenAPI — no hay endpoints nuevos ni modificados.

## Modelado de datos

Sin tablas nuevas ni modificadas. El `InMemoryEventStore` opera enteramente en memoria; el adaptador `PostgresEventStore` (EP-1.5, ya implementado) usa la tabla `event_store` creada en la migración `1790000000001-CreateEventStore.ts`, que no requiere cambios.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Se agregan solo dos guards (3 líneas cada uno) y un test case — sin nuevas capas, abstracciones ni dependencias. |
| Anti-Abstraction | ✅ | Los guards usan condicionales directos (`if (!changes.length)` / `if (!events.length)`) sin wrappers ni patrones indirectos. El `EventStore` ya es el puerto definido por el proyecto. |
| Integration-First | ✅ | Sin endpoints nuevos — no aplica contrato OpenAPI. El contrato del `EventStore` ya estaba definido y verificado por la suite de contract tests existente; el nuevo test case (AC-11) extiende ese contrato. |
| Test-First | ✅ | El nuevo test case en `describeEventStoreContract` se agregará primero (fallará contra el `InMemoryEventStore` actual), luego se implementarán los guards para que pase — TDD estricto (Artículo 4). |
