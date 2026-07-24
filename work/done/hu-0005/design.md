# design: hu-0005

## Decisiones de Diseño

Sin unknowns pendientes — todos los artefactos descritos en `hu.md` ya están implementados en el código base. Este documento registra retroactivamente el diseño para trazabilidad.

## Flujo entre microservicios

El command bus es un flujo interno de `apps/ledger`. Un comando (`Command`) se despacha a través de una cadena fija de 3 políticas (`AuthenticatedContextPolicy` → `IdempotencyPolicy` → `OptimisticConcurrencyPolicy`) antes de llegar al `CommandHandler` que orquesta el agregado, persiste vía `EventSourcedRepository` → `EventStore`, y despacha la proyección síncrona. Los handlers retornan exclusivamente `CommandResult` (`aggregateId`, `streamPosition`, `idempotentReplay`), nunca datos de read model (RNF-10).

> Diagrama de secuencia completo: `docs/diagram.md`.

## Componentes del módulo

El subsistema de command bus agrega 13 componentes al `shared-kernel` de `apps/ledger`: `Command`, `CommandHandler<T>`, `CommandBus`, `PolicyCommandBus`, `CommandPolicy`, `CommandNext`, `CommandResult`, `AuthContext`, y las 3 políticas + 2 excepciones asociadas. El wiring se materializa en `createLedgerApplication()` (`ledger/application/ledger-application.factory.ts`) y se expone como `CommandBus` desde `LedgerCoreModule`.

> Diagrama C4 Nivel 3 acumulativo (incluye event store, repositorios, proyecciones y command bus): `docs/component.md`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El command bus y sus políticas son un subsistema interno del `shared-kernel` de `apps/ledger`. No agrega ningún app/microservicio nuevo, lib compartida, ni integración externa. El alcance es estrictamente interno al módulo `shared-kernel` y a los handlers cableados en `createLedgerApplication()`.

## Contratos por microservicio

Esta historia no expone endpoints HTTP (fuera del alcance de EP-1; los adaptadores HTTP se construirán en EP-2). El contrato interno del command bus está definido por las clases abstractas `Command`, `CommandHandler`, `CommandBus` y `CommandPolicy` en `shared-kernel/application/command-bus/`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | El command bus usa Chain of Responsibility con orden fijo cableado en fábrica — sin abstracciones innecesarias. |
| Anti-Abstraction | ✅ | `PolicyCommandBus` implementa directamente el patrón; las políticas son `abstract class CommandPolicy` puras sin envoltorios de framework. |
| Integration-First | ✅ | No hay endpoints HTTP en esta historia. El contrato es la interfaz `CommandBus` con `dispatch(command, ctx) → CommandResult`, verificada por los specs de los handlers. |
| Test-First | ✅ | La HU exige TDD estricto (RNF-12). Los specs de handlers usan `InMemoryEventStore` + `Clock`/`IdGenerator` deterministas y deben escribirse antes del código de producción (Artículo 4). |
