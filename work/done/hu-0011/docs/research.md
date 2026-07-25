# research: hu-0011

Decisiones técnicas no triviales evaluadas durante el diseño. Las preguntas de
contrato (status de `ACCOUNT_CLOSED` y `LEDGER_NOT_INITIALIZED`, ubicación del
const, alcance de la tabla) se resolvieron con el usuario en PHASE 3 y quedan
registradas en `../design.md` → `## Decisiones de Diseño`.

## Decisión: `InvalidCurrencyCodeException` de settings reusa el code `INVALID_CURRENCY_CODE`

- **Contexto:** el módulo `settings` tiene su propio VO `CurrencyCode`
  (`settings/domain/ledger-settings/value-objects/currency-code.vo.ts`) que lanza
  una `InvalidCurrencyCodeException extends Error` — duplicada en nombre y
  semántica con la del shared-kernel
  (`shared-kernel/domain/value-objects/value-object.exception.ts`, code
  `INVALID_CURRENCY_CODE`, 422). Al sumar settings al contrato RF-14 había que
  elegir el code expuesto.
- **Opciones evaluadas:**
  1. Reusar el code `INVALID_CURRENCY_CODE` ya existente — pros: misma condición
     semántica (código de moneda inutilizable) → mismo contrato para el consumidor;
     el mapping-spec verifica que ambas clases emitan el mismo string. Contras:
     dos clases con el mismo nombre en módulos distintos (preexistente).
  2. Acuñar un code nuevo (`SETTINGS_INVALID_CURRENCY` o similar) — pros:
     distingue el módulo origen. Contras: infla la tabla con un code redundante
     para la misma condición; el consumidor no puede actuar distinto ante él
     (viola el espíritu de RF-14: códigos accionables, no decorativos).
  3. Eliminar el VO duplicado de settings y consumir el del shared-kernel — pros:
     deduplicación real. Contras: refactor fuera del alcance de esta HU (toca el
     agregado LedgerSettings y sus tests); esta HU congela contrato, no refactoriza
     módulos.
- **Elegida:** opción 1 — la excepción de settings se reclasifica
  `extends DomainUnprocessableException` con `code = 'INVALID_CURRENCY_CODE'`.
- **Descartadas por:** (2) code redundante para la misma condición; (3) fuera de
  alcance — queda anotado en `design.md` como refactor pendiente.

## Decisión: las excepciones siguen hardcodeando su `code`; el const es fuente única verificada por test

- **Contexto:** `LEDGER_ERROR_CODE` es la fuente única de los strings RF-14
  (AC-4), pero las excepciones existentes declaran `readonly code: string =
  'CONCURRENCY_CONFLICT'` hardcodeado. Para los 6 códigos nuevos había que
  decidir si se sigue el patrón o se importa el const desde cada excepción.
- **Opciones evaluadas:**
  1. Hardcodear + mapping-spec tabular como drift-catcher (patrón vigente) —
     pros: consistente con las ~20 excepciones existentes; el contract test ya
     garantiza que code emitido ≡ const (cualquier drift rompe CI); las
     excepciones de dominio no importan nada, ni siquiera un const. Contras:
     el "single source" se enforcea por test, no por el type system.
  2. Importar `LEDGER_ERROR_CODE.X` en cada excepción — pros: drift imposible
     por compilación. Contras: rompe la uniformidad del código existente (dos
     estilos conviviendo) sin ganancia real — el spec ya cubre el drift.
- **Elegida:** opción 1 — los 6 códigos nuevos se hardcodean siguiendo el patrón;
  el mapping-spec (AC-5) crece con una fila por code y es el garante del
  contrato.
- **Descartadas por:** (2) inconsistencia de estilo sin beneficio sobre el
  mecanismo de verificación ya existente.

## Decisión: el API delta es solo schemas — no se anotan los endpoints existentes

- **Contexto:** RF-14 no agrega endpoints; el contrato nuevo es el cuerpo de
  error uniforme y el enum de códigos que **todos** los endpoints ya devuelven
  de facto (el filter global está registrado desde hu-0009/hu-0011).
- **Opciones evaluadas:**
  1. `api.delta.yaml` con `components.schemas` (`ErrorResponseBody` +
     `LedgerErrorCode`) y `paths: {}` — pros: delta mínimo y veraz; `/sync`
     reconcilia los schemas en `docs/shared/api.yaml` y decide con `oasdiff`
     si anexar las responses de error a los endpoints existentes (aditivo,
     no-breaking). Contras: el delta no muestra explícitamente qué endpoint
     devuelve qué codes — esa tabla vive en `flows/map-domain-error.md`.
  2. Re-declarar en el delta todos los paths existentes con sus `responses`
     4xx — pros: contrato por endpoint explícito. Contras: duplica paths que ya
     viven en los `api.yaml` de cada módulo (drift garantizado); viola la
     regla del modo delta (solo lo que la HU agrega o cambia).
- **Elegida:** opción 1 — schemas compartidos + tabla semántica en el flow doc.
- **Descartadas por:** (2) duplicación de contratos ya publicados.
