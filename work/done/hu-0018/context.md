# context: hu-0018

## Historia resumida

**Como** cliente autenticado del ledger
**Quiero** cambiar la moneda de presentación y la zona horaria vía API
**Para** que la conciliación calcule el cierre del día en mi huso real, sin depender de los
valores fijados al inicializar

## App afectada

`apps/ledger` — módulos `ledger` (agregado + aplicación), `accounts` (donde vive el
`LedgerController`) y `settings` (value objects conservados del intento de EP-4).

---

## Lo que ya existe (y reduce mucho la historia)

### El dominio está completo

`src/ledger/domain/settings/ledger-settings.aggregate.ts` ya expone:

- `changePresentationCurrency(currency: CurrencyCode)` — emite `PresentationCurrencyChanged`,
  **no-op si el valor no cambia** (AC-6 ya garantizado por el agregado).
- `changeTimezone(timezone: IanaTimeZone)` — ídem con `TimezoneChanged`.
- `isInitialized: boolean` — la guarda que AC-7 necesita.
- `apply()` ya maneja los tres eventos.

Los eventos viven en `src/settings/domain/ledger-settings/events/` y los value objects
`CurrencyCode` / `IanaTimeZone` en `src/settings/domain/ledger-settings/value-objects/`,
ambos con su validación (AC-4, AC-5).

### AC-2 ya está cumplido

`GET /v1/ledger/settings` existe en `src/accounts/infrastructure/adapters/http/ledger.controller.ts`,
con `GetLedgerSettingsQuery` y su handler en `src/read-side/get-ledger-settings/`. El JSDoc
del controller dice literalmente *«Settings mutations belong to EP-4 and are intentionally
absent»* — esta historia cierra esa frase.

### Infraestructura reusable

- `LedgerSettingsRepository` (`src/ledger/application/ledger-settings.repository.ts`).
- `CommandResultInterceptor` + `CommandAcceptedDto` — dan el header
  `X-Ledger-Stream-Position` que AC-8 (read-your-writes) necesita, ya aplicados al
  controller.
- `LEDGER_NOT_INITIALIZED` ya existe como código estable en
  `src/shared/domain/errors/ledger-error-code.ts:19`, y `reconciliation` ya tiene una
  excepción que lo usa — el código se reutiliza, no se inventa.

---

## Lo que falta

| AC | Qué falta |
|---|---|
| AC-1 | `ReplaceLedgerSettingsCommand` + handler; registrarlo en `ledger-application.factory.ts` |
| AC-3 | `PUT /v1/ledger/settings` en `LedgerController` + DTO de request |
| AC-7 | Excepción en el módulo de settings que use `LEDGER_NOT_INITIALIZED` |
| AC-9 | `LedgerSettingsProjector.consumes` solo trae `LedgerInitialized` |
| AC-10 | Verificar de punta a punta que el huso nuevo llega a la conciliación |

---

## Gaps detectados

1. **Los eventos de cambio no están en el `EventRegistry`.**
   `src/ledger/application/ledger-event-registry.factory.ts` registra `LedgerInitialized`,
   los tres de `Account` y los seis de `LedgerTransaction`, pero **no**
   `PresentationCurrencyChanged` ni `TimezoneChanged`. Consecuencias si no se corrige:
   - `LedgerSettingsRepository.load()` no puede rehidratar un agregado que ya tenga uno de
     esos eventos → el segundo cambio de configuración fallaría.
   - Un `rebuild ledger_settings` no los deserializa → la proyección quedaría con los
     valores de inicialización.

   No lo menciona ningún AC, pero sin esto AC-1 no funciona más allá del primer cambio. Se
   incorpora al alcance.

2. **`LedgerSettingsProjector` escribe la fila completa desde `LedgerInitialized`.** Al
   agregar los eventos de cambio hay que aplicar el patrón leer-mezclar-escribir que hu-0015
   estableció: `upsert` reemplaza la fila entera según el contrato del puerto, así que un
   `PresentationCurrencyChanged` que escriba solo su columna borraría los ids de las cuentas
   técnicas.

3. **El PUT reemplaza, pero el agregado tiene dos métodos separados.** El handler invoca
   ambos y persiste una sola vez — los dos eventos van en el mismo append, que es lo que
   hace atómica la operación (§3.5). Hay que verificar que
   `LedgerSettingsRepository.save()` agrupa `pullChanges()` en un único `append`.

4. **`proj_ledger_settings` no tiene columna `updated_at`.** La migración que corregí en
   `ba18de3` la quitó porque ningún projector la escribía. Si el DTO de respuesta la
   expone, hay que agregarla; si no, no hace falta tocar el esquema.
