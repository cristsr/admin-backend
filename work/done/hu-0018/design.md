# design: hu-0018

## Decisiones de Diseño

- **`PUT /v1/ledger/settings` que reemplaza la configuración completa** (elegido por el
  usuario). El riesgo que se le señaló —dos commands en una petición, con estado intermedio
  si el segundo falla— **no se materializa**: `LedgerSettings` es un único agregado cuya
  raíz es el `user_id`, y `EventSourcedRepository.save()` agrupa todos los `pullChanges()`
  en **un solo `append`**. Un command que invoca ambos cambios emite los dos eventos
  atómicamente sobre el mismo stream (§3.5). Verificado en
  `event-sourced.repository.ts:43-56`.
- **Un command, no dos:** `ReplaceLedgerSettingsCommand`. Despachar dos commands desde el
  controller sí habría roto la atomicidad; un command que orquesta dos métodos del mismo
  agregado, no.
- **Los eventos de cambio se registran en el `EventRegistry`.** No lo pide ningún AC, pero
  sin eso `LedgerSettingsRepository.load()` no puede rehidratar un agregado que ya tenga un
  cambio previo — el segundo PUT fallaría — y un rebuild de `ledger_settings` ignoraría los
  cambios. Es condición necesaria de AC-1.
- **El projector aplica leer-mezclar-escribir**, siguiendo lo que hu-0015 estableció: el
  contrato de `upsert` reemplaza la fila entera, así que escribir solo la columna cambiada
  borraría los ids de las cuentas técnicas.
- **`LEDGER_NOT_INITIALIZED` se reutiliza**, no se inventa: ya existe como código estable y
  ya tiene una excepción en `reconciliation`. Se agrega la equivalente en el módulo de
  settings.

## Flujo

`PUT /v1/ledger/settings` → `ReplaceLedgerSettingsCommand` → el handler carga el agregado,
verifica que esté inicializado, invoca `changePresentationCurrency` y `changeTimezone`
(ambos no-op si el valor no cambia) y persiste una sola vez. El `LedgerSettingsProjector`
consume los dos eventos nuevos y actualiza `proj_ledger_settings` conservando el resto de
la fila. La conciliación lee ese mismo read model vía `LedgerSettingsReader`, así que el
huso nuevo entra en vigor para la próxima evaluación de aserciones.

| Caso de uso | Op | Trigger | Entrypoint | Doc |
|---|---|---|---|---|
| Reemplazar la configuración | create | rest | `PUT /v1/ledger/settings` | [replace-ledger-settings](./docs/flows/replace-ledger-settings.md) |

## Componentes del módulo

`ReplaceLedgerSettingsHandler` nuevo en `ledger/application/`; `LedgerSettingsProjector`
gana dos eventos consumidos; `LedgerController` gana el verbo `PUT`. El agregado y sus
value objects no se tocan.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

- **Nivel:** N/A
- **Cambio:** ninguno
- **Nodo/arista concreto:** N/A — el endpoint se agrega a un controller existente y el
  command a un agregado existente. No hay módulo, app ni integración nueva.

## Contratos por módulo

| Método | Ruta | Descripción |
|---|---|---|
| PUT | `/v1/ledger/settings` | Reemplaza moneda de presentación y zona horaria |

`GET /v1/ledger/settings` ya existe y no cambia su contrato.

## Modelado de datos

Sin cambios. `proj_ledger_settings` ya tiene `presentation_currency` y `timezone`, y el DTO
de respuesta no expone `updated_at`, así que la migración corregida en `ba18de3` sigue
sirviendo tal cual.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Un command, un endpoint, dos líneas en el projector. El dominio ya estaba completo: la historia solo cablea. |
| Anti-Abstraction | ✅ | Reusa `CommandResultInterceptor`, `LedgerSettingsRepository` y los value objects existentes; no introduce capas. |
| Integration-First | ✅ | El contrato del PUT se define antes del handler, y el flow doc precede a la implementación. |
| Test-First | ✅ | El test del handler y el del projector se escriben antes que el código. |

### Artículos verificados

- **Artículo 1:** el handler vive en `application/` y no importa `@nestjs/*`.
- **Artículo 5:** el agregado se carga por `userId`; la configuración es por usuario.
- **Artículo 9 (versionado de eventos):** los eventos ya existen con `schemaVersion = 1`;
  registrarlos en el `EventRegistry` no altera ninguno ya escrito.

## Excepciones a la constitución

Ninguna.
