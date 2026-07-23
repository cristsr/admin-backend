# design: hu-0001

> Generado por /design. Input para /plan.
> Historia de verificación (ver `context.md`): no hay `docs/diagram.md`, `docs/api.yaml`
> ni `docs/data-model.md` — hu-0001 es código de dominio puro (value objects + envelope de
> eventos), sin endpoints HTTP ni tabla nueva. Este `design.md` documenta las decisiones de
> diseño tomadas sobre el código ya existente y el alcance de lo que `/plan` debe cerrar.
> Revisá todo antes de ejecutar `/plan hu-0001`.

## Decisiones de Diseño

- **Ubicación/composición de `Currency` (AC-4):** se acepta el diseño actual —
  `Currency.of(code: string, minorUnits)` en `shared/domain/money/currency.ts`, en vez de
  moverlo a `shared-kernel/domain/value-objects/` con `code: CurrencyCode` como proponía el
  plan original (`EP-1-nucleo.md`). El AC no exige literalmente el tipo `CurrencyCode` como
  parámetro, solo que se asocie un código con su precisión — y así funciona hoy. Forzar el
  realineamiento tocaría `Money`, `SeedCurrencyCatalog` y `PostingSerializer` sin beneficio
  funcional nuevo (YAGNI).
- **Forma de `PostingLine` (AC-6):** se acepta el diseño actual — `class` con comportamiento
  propio (`negated()`, getter `currencyCode`) en `transactions/domain/posting/`, en vez de
  `type` plano en `shared-kernel` como proponía el plan original. Es más consistente con el
  resto de VOs del proyecto (`AccountName`, `Payee`, `CurrencyCode`), que también son `class`
  con comportamiento — Tell-Don't-Ask. Bajarlo a `type` perdería ese comportamiento o lo
  dejaría huérfano en un servicio aparte.
- **Ubicación de `InvalidPayeeException` (AC-3):** se mueve de `payee.ts` (definición local) a
  `value-object.exception.ts`, donde ya viven `InvalidAccountNameException`,
  `RootTypeImmutableException`, `InvalidCurrencyCodeException` y `UnknownCurrencyException`.
  Cambio mecánico de bajo riesgo por consistencia de organización.

## Alcance del núcleo (sin flujo HTTP)

`AccountName`, `Payee`, `CurrencyCode`/`Currency`/`CurrencyCatalog`, `PostingLine`,
`DomainEvent`/`EventEnvelope`/`StoredEvent`/`EventPayload`/`StreamId`, `EventRegistry` y
`EnvelopeFactory` son consumidos internamente por los agregados y casos de uso del ledger
(`accounts/domain/account/`, `transactions/domain/transaction/`, etc.) — no se exponen
directamente vía ningún endpoint. No aplica diagrama de secuencia HTTP ni contrato OpenAPI.

## Cierre de gaps — input para /plan

Del checklist AC-by-AC de `context.md`, el único gap accionable es **AC-7** (cobertura de
tests del round-trip de serialización). Acciones concretas para `/plan`:

1. **`posting.serializer.spec.ts`** (nuevo) — probar
   `PostingSerializer.toPayload()`/`fromPayload()` con montos en COP (0 decimales) y en USD
   (2 decimales), verificando que el valor decimal se preserva exacto en el round-trip
   payload → `PostingLine` → payload, y que `fromPayload` reconstruye `Money` a la escala
   correcta vía `CurrencyCatalog`.
2. **Spec de al menos un evento concreto** (recomendado: `transaction-recorded.event.spec.ts`,
   ya que `TransactionRecorded` es el evento con postings/montos) — probar el round-trip
   completo `toPayload()` → `TransactionRecorded.fromPayload()` → `toPayload()` con montos en
   COP y USD, preservando el valor exacto, satisfaciendo AC-7 literalmente.
3. **Mover `InvalidPayeeException`** de `payee.ts` a `value-object.exception.ts`; actualizar el
   import en `payee.ts`. `payee-line.spec.ts` existente no debería requerir cambios (mismo
   comportamiento, distinta ubicación de la clase).

No se requieren cambios en `AccountName`, `AccountType`, `CurrencyCode`, `Currency`,
`CurrencyCatalog`/`SeedCurrencyCatalog`, `PostingLine`, `DomainEvent`, `EventEnvelope`,
`StoredEvent`, `EventPayload`, `StreamId`, `EventRegistry` ni `EnvelopeFactory` — los 9 AC
restantes ya cumplen sin gaps.

## Validación de Quality Gates

No existe `constitution.md` en el proyecto — se aplican los 4 gates built-in por defecto.
Ejecutar `/constitution` los haría exigibles a nivel de proyecto.

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | No se fuerza ninguna reubicación/reestructuración sin beneficio funcional; el único cambio de código es mover una excepción a su archivo compartido. |
| Anti-Abstraction | ✅ | No se introduce ninguna abstracción nueva — se mantienen los patrones directos ya establecidos (factories estáticas, `abstract class` para puertos). |
| Integration-First | ✅ | No aplica contrato externo (no hay HTTP); el contrato interno (envelope/eventos) ya está definido y probado por specs existentes (`event-registry.spec.ts`, `envelope.factory.spec.ts`). |
| Test-First | ⚠️ | AC-7 detectó specs faltantes para código de producción ya existente (`posting.serializer.ts`, eventos concretos). Ver excepción abajo — es backfill de cobertura, no TDD estricto en sentido literal. |

## Excepciones a la constitución

- **Test-First (regla del proyecto: "cada archivo de producción se precede por su
  `*.spec.ts`"):** `posting.serializer.ts` y los `*.event.ts` concretos ya fueron
  implementados en el commit original de EP-1 sin sus specs. Esta historia de verificación no
  puede reescribir el código para simular TDD retroactivo — el gap se cierra agregando los
  specs faltantes ahora (backfill), documentado como tarea explícita en `/plan`, en vez de
  ignorarlo silenciosamente. Aprobado por el usuario en esta sesión.
