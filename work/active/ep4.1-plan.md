# Plan TDD — EP-4.1 LedgerSettings

## Resumen
EP-4.1 extiende el agregado `LedgerSettings` existente con soporte para cambiar moneda de presentación y zona horaria. Implementa proyección actualizada, handlers de command, query handler, y controller HTTP.

**Estimación: 10 SP (S/M)**

---

## Tasks (Ordenadas: Unit → Integration → e2e)

### Bloque Unit: Value Objects (2 tasks)

- [ ] **1.1 [Unit] Value Objects: CurrencyCode y IanaTimeZone validation**
  - Crear `apps/ledger/src/settings/domain/ledger-settings/value-objects/currency-code.vo.ts` y `.spec.ts`
  - Crear `apps/ledger/src/settings/domain/ledger-settings/value-objects/iana-timezone.vo.ts` y `.spec.ts`
  - Test casos válidos (COP, USD, America/Bogota) e inválidos (empty, XXX, Invalid/Zone)
  - Excepciones: `InvalidCurrencyCodeException`, `InvalidTimeZoneException`
  - Usar Intl API para validación de zona horaria
  - **Precondiciones**: Ninguna
  - **Criterios**: Constructores lance excepciones; toString() retorne valores; equals() funcione
  
- [ ] **1.2 [Unit] Agregado: LedgerSettings.changePresentationCurrency() y changeTimezone()**
  - Extend `apps/ledger/src/ledger/domain/settings/ledger-settings.aggregate.ts` (existente)
  - Añadir métodos `changePresentationCurrency(currency: CurrencyCode): void`
  - Añadir método `changeTimezone(timezone: IanaTimeZone): void`
  - Implementar: no-op idempotente si valor no cambia
  - Crear spec: `ledger-settings.aggregate.spec.ts` si no existe; ampliar si existe
  - Test: rehidratación desde `LedgerInitialized` + eventos de cambio
  - Emitir `PresentationCurrencyChanged` y `TimezoneChanged` solo si difieren
  - **Precondiciones**: Task 1.1 (value objects)
  - **Criterios**: `uncommittedEvents` contiene evento solo si es diferente; versión correcta

### Bloque Unit: Projector (1 task)

- [ ] **1.3 [Unit] Projector: LedgerInitialized inserta fila; Changed eventos actualizan**
  - Crear `apps/ledger/src/settings/infrastructure/projections/ledger-settings.projector.ts` y `.spec.ts`
  - Projector reacciona a: `LedgerInitialized`, `PresentationCurrencyChanged`, `TimezoneChanged`
  - Insert en `LedgerInitialized` con valores `presentation_currency`, `timezone`
  - Update en cada `Changed` event + actualizar `updated_at`
  - Test rebuild: proyectar stream 2x debe producir idéntico resultado (determinismo)
  - **Precondiciones**: Tasks 1.1, 1.2
  - **Criterios**: Fila crea con valores init; cambios actualizan; rebuild determinista

### Bloque Integration: Handlers (2 tasks)

- [ ] **1.4 [Integration] ChangePresentationCurrencyHandler: command → evento → projector**
  - Crear `apps/ledger/src/settings/application/commands/change-presentation-currency.command.ts`
  - Crear `apps/ledger/src/settings/application/handlers/change-presentation-currency.handler.ts` y `.spec.ts`
  - Handler carga agregado, llama `changePresentationCurrency()`, persiste
  - Test idempotencia: X veces el mismo comando = un evento
  - Usar `LedgerSettingsRepository` (puerto, reutilizar o crear)
  - **Precondiciones**: Tasks 1.1–1.3
  - **Criterios**: Evento persisted; proyección actualizada; idempotente

- [ ] **1.5 [Integration] GetLedgerSettingsHandler + Query: read-your-writes (RNF-9)**
  - Crear `apps/ledger/src/settings/application/queries/get-ledger-settings.query.ts`
  - Crear `apps/ledger/src/settings/application/handlers/get-ledger-settings.handler.ts` y `.spec.ts`
  - Handler lee `proj_ledger_settings` via `ReadModelStore`
  - Test read-your-writes: tras cambio, query con posición de comando refleja cambio
  - Crear DTOs: `LedgerSettingsOutputDto`, `LedgerSettingsMapper`
  - **Precondiciones**: Tasks 1.1–1.4
  - **Criterios**: DTO refleja cambio; read-your-writes verificado

### Bloque e2e: Controller (1 task)

- [ ] **1.6 [e2e] Controller: PATCH /ledger/settings, GET /ledger/settings**
  - Crear `apps/ledger/src/settings/infrastructure/adapters/http/ledger-settings.controller.ts` y `.spec.ts`
  - Crear `apps/ledger/src/settings/application/commands/change-settings-input.dto.ts`
  - Crear `apps/ledger/src/settings/domain/ledger-settings/events/ledger-settings-events.ts`
  - Endpoints:
    - `PATCH /ledger/settings` + `{ presentationCurrency?: string, timezone?: string }` → 202 + CommandAcceptedDto
    - `GET /ledger/settings` → 200 + LedgerSettingsDto
  - Sin contexto autenticado → 401/403 (RF-26)
  - Test: read-your-writes; código de moneda no registrada (validación inter-agregado relajada)
  - **Precondiciones**: Tasks 1.1–1.5
  - **Criterios**: HTTP correcto; autenticación; read-your-writes; domain errors estables

### Bloque Infraestructura: DDL + Wiring (2 tasks)

- [ ] **1.7 [Infra] Migración DDL: proj_ledger_settings table (si no existe)**
  - Verificar si `proj_ledger_settings` ya existe en migraciones
  - Si no existe: crear `apps/ledger/src/database/migrations/1790000000004-CreateLedgerSettingsProjection.ts`
  - Columnas: `user_id (UUID PK)`, `presentation_currency (TEXT)`, `timezone (TEXT)`, `updated_at (TIMESTAMPTZ)`
  - Si ya existe: verificar esquema; ajustar si necesario
  - **Precondiciones**: Ninguna
  - **Criterios**: Tabla existe; esquema correcto

- [ ] **1.8 [Infra] Wireado: settings.module.ts + app.module.ts**
  - Crear `apps/ledger/src/settings/settings.module.ts`
  - Wire: CommandHandlers (`ChangePresentationCurrencyHandler`, `ChangeTimezoneHandler`)
  - Wire: QueryHandlers (`GetLedgerSettingsHandler`)
  - Wire: Projectors (`LedgerSettingsProjector`)
  - Wire: Controllers (`LedgerSettingsController`)
  - Crear `apps/ledger/src/settings/index.ts` con exports
  - Actualizar `apps/ledger/src/app.module.ts` para importar `SettingsModule`
  - Actualizar `ledger-event-registry.factory.ts` para registrar eventos nuevos
  - **Precondiciones**: Tasks 1.1–1.7
  - **Criterios**: Módulo compila; no imports colgantes; eventos registrados

### Validación Final (1 task)

- [ ] **1.9 [Validación] Criterios de aceptación e2e completos**
  - `nx build ledger` ✅
  - `nx lint ledger` ✅
  - Una fila exacta en `proj_ledger_settings` por usuario tras `InitializeLedger`
  - `GET /ledger/settings` la devuelve sin error
  - `PATCH /ledger/settings` cambia moneda/zona en proyección
  - Cambio al mismo valor no emite evento (idempotencia)
  - Cambio sin contexto autenticado → 401
  - Read-your-writes: query inmediata tras command devuelve cambio
  - **Precondiciones**: Tasks 1.1–1.8
  - **Criterios**: Todos los tests pasan; build limpio; criterios e2e verificados

---

## Decisiones Técnicas (del plan EP-4)

1. **Reutilizar VOs**: Se usan `CurrencyCode`/`MinorUnits` de `shared-kernel` si es posible; si hay conflicto, crear versiones propias
2. **Uso de LedgerDate**: Usar `LedgerDate` (existe) no `PlainDate` (alias conceptual del spec)
3. **No-op idempotente**: Cambio al mismo valor no emite evento (idempotencia de dominio)
4. **Validación de moneda**: Inter-agregado relajada (consulta `proj_currencies` en handler, no falla hard)
5. **Timezone no retroactivo**: Documentar que cambio de zona solo afecta futuro (no re-evalúa aserciones previas en v1)

---

## Notas de Implementación

- **Evento types**: Crear `ledger-settings-events.ts` con tipos `PresentationCurrencyChanged`, `TimezoneChanged`
- **Excepciones**: Crear `settings.exception.ts` con tipos custom (no throw raw Error)
- **Comentarios**: English + JSDoc (skill `typescript`)
- **Patrones**: Reutilizar patrones de EP-1..EP-3 (handlers, projectors, controllers)
- **Skills obligatorias**: `typescript`, `design-principles`, `error-handling` al escribir TypeScript

---

## Referencia de Archivos Clave

- Extend: `apps/ledger/src/ledger/domain/settings/ledger-settings.aggregate.ts`
- Extend: `apps/ledger/src/ledger/application/ledger-application.factory.ts` (registrar eventos + handlers)
- Extend: `apps/ledger/src/app.module.ts` (import SettingsModule)
- Create: `apps/ledger/src/settings/` (todo el módulo nuevo)
