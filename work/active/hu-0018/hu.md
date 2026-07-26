# hu-0018: Endpoints de configuración del ledger — moneda de presentación y zona horaria

## Historia de Usuario

**Como** cliente autenticado del ledger
**Quiero** cambiar la moneda de presentación y la zona horaria de mi ledger vía API
**Para** que los saldos se muestren en la moneda que uso y la conciliación calcule el
cierre del día en mi huso horario real, sin depender de los valores fijados al inicializar

## Criterios de Aceptación

### AC-1: Commands y handlers de cambio de configuración

Existen los commands `ChangePresentationCurrencyCommand` y `ChangeTimezoneCommand` con sus
handlers, despachados por el `CommandBus` real. El agregado `LedgerSettings`
(`src/ledger/domain/settings/ledger-settings.aggregate.ts`) **ya expone**
`changePresentationCurrency()` y `changeTimezone()` con los eventos
`PresentationCurrencyChanged` y `TimezoneChanged`: esta historia cablea la capa de
aplicación y el adaptador HTTP que faltan, no reescribe el dominio.

### AC-2: Endpoint de lectura

`GET /v1/ledger/settings` devuelve la configuración del usuario desde
`proj_ledger_settings`. La query `GetLedgerSettingsQuery` y su handler ya existen en
`src/read-side/get-ledger-settings/`; falta exponerlos por HTTP.

### AC-3: Endpoints de escritura

Existen los endpoints que despachan cada command con el contexto autenticado (RF-26) y la
referencia externa idempotente (RF-11).

[NEEDS CLARIFICATION: ¿la superficie es un único `PATCH /v1/ledger/settings` que acepta
`presentationCurrency` y/o `timezone` en el mismo body, o dos endpoints separados
(`POST /v1/ledger/settings/presentation-currency` y `.../timezone`)? Lo primero es más
REST-idiomático pero despacha dos commands en una petición, lo que rompe la
correspondencia 1:1 endpoint→command que sigue el resto del API.]

### AC-4: Validación de la moneda de presentación

La moneda debe existir en el catálogo de monedas; si no, se rechaza con un código de error
de dominio estable (RF-14). El value object `CurrencyCode` de
`src/settings/domain/ledger-settings/value-objects/` ya valida el formato ISO-4217.

### AC-5: Validación de la zona horaria

La zona horaria debe ser un identificador IANA válido. El value object `IanaTimeZone` ya
lo valida; el endpoint debe traducir su fallo a un código de error estable.

### AC-6: Cambiar a un valor idéntico no emite evento

El agregado ya es idempotente por diseño (no-op si el valor no cambia). El endpoint
responde igualmente `2xx` en ese caso, sin agregar un evento al stream.

### AC-7: El ledger debe estar inicializado

Cambiar la configuración de un ledger no inicializado se rechaza con un código de error de
dominio estable.

[NEEDS CLARIFICATION: `INTEGRATION.md` registró que `LEDGER_NOT_INITIALIZED` fue
identificado como código necesario pero **no tiene excepción real** en el código. ¿Se crea
esa excepción en esta historia, o el caso se cubre con `NOT_FOUND` sobre el agregado
inexistente?]

### AC-8: Read-your-writes

Tras un `2xx` en un cambio de configuración, un `GET /v1/ledger/settings` inmediato
devuelve el valor nuevo (RNF-9), con el mismo mecanismo que hu-0012 estableció para el
resto del API.

### AC-9: La proyección refleja los cambios

`LedgerSettingsProjector` consume `PresentationCurrencyChanged` y `TimezoneChanged` además
de `LedgerInitialized`. Hoy solo consume el último
(`ledger/infrastructure/projections/ledger-settings.projector.ts:26`), así que un cambio
de moneda o de huso no llegaría nunca a `proj_ledger_settings` — y `EvaluateAssertion`
seguiría usando la zona horaria vieja.

### AC-10: La conciliación usa la zona horaria actualizada

Tras cambiar la zona horaria, `LedgerSettingsReader` (consumido por
`IntlDayBoundaryResolver` en `reconciliation`) devuelve el valor nuevo, y una evaluación
de aserción posterior usa ese huso para el cierre del día (§2.4, RNF-7).

## Reglas de Negocio

- Todo timestamp se almacena en UTC; la zona horaria solo se aplica al vuelo para derivar
  fechas contables y cierres de día (RNF-7).
- El cambio de moneda de presentación **no altera ningún evento ni monto ya registrado**:
  es un parámetro de presentación, no de registro (§2.7, principio #5).
- Toda operación exige contexto autenticado `(user_id, client_id)` (RF-26).

## Fuera de Alcance

- La conversión de saldos a la moneda de presentación (valoración `net_worth`, RF-23):
  fuera del alcance del ledger por el recorte del 2026-07-25.
- El registro de tasas de cambio (RF-22): fuera del alcance por el mismo recorte.
- El catálogo de monedas administrable: es hu-0019.
