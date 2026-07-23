# context: hu-0001

> Generado por /scan. Input para /design y /plan.
> No editar manualmente — re-ejecutar /scan si el contexto cambió.

## Historia resumida

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** contar con los value objects inmutables del dominio contable (`AccountName`,
`Payee`, `CurrencyCode`/`Currency`, `PostingLine`) y con el envelope de eventos de dominio
(`DomainEvent`, `EventEnvelope`, `StoredEvent`, `EventPayload`, `StreamId`, `EventRegistry`,
`EnvelopeFactory`)
**Para** que el resto del núcleo (agregados, `EventStore`, proyecciones) tenga un contrato
estable, inmutable y probado sobre el que construir, sin depender de infraestructura ni de
NestJS

Corresponde a **EP-1.1 + EP-1.2** del roadmap del ledger.

## Microservicios afectados

- `apps/ledger` (app Nx nueva, event sourcing + CQRS + partida doble)

---

## ⚠️ Naturaleza de esta historia: verificación, no build

`hu-0001..hu-0008` no piden construir desde cero: la épica EP-1 (y las siguientes) se
implementó de una sola vez tomando la épica completa como unidad, y resultó demasiado grande
para trabajar/revisar así. Estas historias trocean cada épica en piezas auditables
**después de que el código ya existe**, para comprobar a nivel de AC qué quedó completo y qué
falta — no para generar artefactos nuevos.

El branch actual (`feat/core`) ya contiene los commits `merge(ledger): integrate EP-1/EP-2/EP-3
into feat/core` y `feat(ledger): implement EP-4.2/4.3/4.4/4.5/4.6 + EP-5`.

`ledger-roadmap.md` y `work/ledger/EP-1-nucleo.md` no marcan EP-1.1/EP-1.2 como `[x]` pese a
estar implementados — desactualizado, no bloqueante.

## Checklist AC-by-AC

| AC | Descripción | Veredicto | Detalle |
|---|---|---|---|
| AC-1 | `AccountName` modela jerarquía por nombre | ✅ **CUMPLE** | `account-name.ts` completo (`of`, `rootType`, `value`, `parentName()`, `isDescendantOf()`, `equals()`); spec con 12 casos. |
| AC-2 | `reparentFrom` conserva tipo raíz (INV-14) | ✅ **CUMPLE** | `reparentFrom(oldPrefix, newPrefix)` implementado; INV-14 (rechazo si cambia el root type) cubierto en spec. |
| AC-3 | `Payee` distingue contraparte de descripción libre | ✅ **CUMPLE** (gap menor) | Trim, colapso a `null` si vacío, tope 255 (`MAX_LENGTH`) — todo implementado. `InvalidPayeeException` está definida localmente en `payee.ts` en vez del archivo de excepciones compartido de VOs — cosmético, no funcional. |
| AC-4 | `CurrencyCode`/`Currency` fijan escala decimal (INV-8) | ✅ **CUMPLE** (gap de diseño) | `Money.of` valida la escala contra `currency.minorUnits` — funciona. Pero `Currency.of(code: string, minorUnits)` toma `string` plano en vez de `CurrencyCode`, y vive en `shared/domain/money/` en vez de `shared-kernel/domain/value-objects/` como proponía el plan original. Decisión de diseño a ratificar, no bug. |
| AC-5 | `CurrencyCatalog` resuelve `minorUnits` con seed COP/USD | ✅ **CUMPLE** | **Confirmado**: `seed-currency-catalog.ts` implementa `SeedCurrencyCatalog extends CurrencyCatalog` con `{ COP: 0, USD: 2 }` exacto; lanza `UnknownCurrencyException` (tipada) para códigos no sembrados. Tiene spec propio. |
| AC-6 | `PostingLine` nunca existe sin moneda | ✅ **CUMPLE** (gap de forma) | Combina `accountId` + `Money` (ya validado) + `metadata` inmutable, sin duplicar validación de escala. Implementado como `class` en `transactions/domain/posting/` (el plan proponía `type` en `shared-kernel`) — divergencia de forma/ubicación, no funcional. |
| AC-7 | `DomainEvent` serializa montos siempre como string decimal, round-trip COP/USD | ⚠️ **GAP DE COBERTURA DE TESTS** | La implementación es correcta: `PostingSerializer.toPayload/fromPayload` serializa vía `Money.toDecimalString()` y reconstruye `Money` vía `CurrencyCatalog` — nunca `number`. **Pero no existe `posting.serializer.spec.ts` ni spec dedicado para `TransactionRecorded`/otros eventos concretos** que pruebe explícitamente el round-trip payload→evento→payload con montos en COP y en USD, como pide el AC literalmente. Viola además la regla de TDD estricto del proyecto (cada archivo de producción con su `*.spec.ts` — ningún `*.event.ts` concreto tiene spec propio). |
| AC-8 | Envelope lleva procedencia completa e inmutable, `userId` obligatorio | ✅ **CUMPLE** | `EventEnvelope`/`StoredEvent` son `type` con todos los campos pedidos (`eventId, userId, aggregateType, aggregateId, sequence, eventType, schemaVersion, clientId, externalRef: Nullable<string>, payload, occurredAt, recordedAt`, + `globalPosition` en `StoredEvent`). `userId: string` no-nullable — el sistema de tipos impide construir un envelope sin él (INV-9). |
| AC-9 | `EnvelopeFactory` construye envelope determinista | ✅ **CUMPLE** | Spec (`envelope.factory.spec.ts`) confirma con `FixedClock`/`SequentialIdGenerator`: serialización decimal, `sequence` correlativo desde el head persistido, anchor-only stamping de `externalRef`, propagación exacta de `userId`/`clientId`/`eventId`/`recordedAt`. |
| AC-10 | `EventRegistry` centraliza deserialización y upcasting | ✅ **CUMPLE** | Spec (`event-registry.spec.ts`) cubre exactamente el caso del AC: evento v1 con campo `label` se upcastea a v2 (`name`) dentro del deserializador registrado, sin migrar datos in situ; `eventType` desconocido lanza `UnknownEventTypeException` tipada. |

**Resumen:** 9/10 AC cumplen funcionalmente. 3 tienen divergencias de forma/ubicación
respecto al plan original (AC-3, AC-4, AC-6) que son decisiones de diseño a ratificar, no
bugs. **1 gap real de cobertura de tests (AC-7)**: falta spec para `PostingSerializer` y para
al menos un evento concreto (`TransactionRecorded` u otro) que verifique el round-trip
COP/USD explícitamente pedido por el AC y exigido por la regla de TDD estricto del proyecto.

---

## apps/ledger

### Estructura relevante

- `shared-kernel/` — núcleo puro de event sourcing: `domain/aggregate/`, `domain/event/`,
  `domain/value-objects/`, `application/command-bus/`, `application/event/`.
- `shared/` — plataforma técnica propia del ledger: `domain/money/` (Money, Currency,
  excepciones), `domain/ports/` (`Clock`, `IdGenerator`), `infrastructure/`, `testing/`.
- **`shared` y `shared-kernel` son carpetas raíz distintas** — no confundir al ubicar
  archivos nuevos.
- Módulos de dominio contable construidos sobre este núcleo: `accounts/domain/account/`
  (agregado `Account`), `transactions/domain/posting/` (`PostingLine`), `ledger/domain/settings/`.

### Value objects contables (AC-1 a AC-6)

| Artefacto | Path absoluto | Estado |
|---|---|---|
| `AccountName` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\value-objects\account-name.ts` | Completo: `of()`, `rootType`, `value`, `leaf`, `parentName()`, `isDescendantOf()`, `reparentFrom(oldPrefix, newPrefix)`, `equals()`, `toString()`. Spec: `account-name.spec.ts` (12 casos, incl. INV-14). |
| `AccountType` | `...\value-objects\account-type.ts` | Enum de app-layer (5 raíces) + `ROOT_TYPE_LABEL` + `REAL_ACCOUNT_TYPES` + `rootTypeFromLabel()`. Sin enum de DB — cumple regla del proyecto. |
| `Payee` | `...\value-objects\payee.ts` | `of(raw: Nullable<string>): Nullable<Payee>`, trim, colapso a `null` si queda vacío, tope 255 (`MAX_LENGTH`), `value`, `equals()`. Excepción `InvalidPayeeException` definida localmente (no en `value-object.exception.ts` compartido — inconsistencia menor de organización). |
| `CurrencyCode` | `...\value-objects\currency-code.ts` | `of(raw): CurrencyCode`, normaliza a mayúsculas, `value`, `equals()`, `toString()`. |
| `Currency` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\money\currency.ts` | **Gap de ubicación**: vive junto a `Money` en `shared/domain/money/`, no en `shared-kernel/domain/value-objects/` como proponía `EP-1-nucleo.md`. `Currency.of(code: string, minorUnits: number)` — toma `code: string` plano, no `CurrencyCode` (composición distinta a la planeada). |
| `CurrencyCatalog` | `...\value-objects\currency-catalog.ts` | Puerto `abstract class`: `abstract resolve(code: CurrencyCode): Currency`. JSDoc menciona seed COP/USD pero **no se localizó el adaptador seed concreto** en la exploración — pendiente confirmar en `/design`. |
| `PostingLine` | `D:\Cristian\Nest\admin-back\apps\ledger\src\transactions\domain\posting\posting-line.ts` | **Gap de forma**: implementado como `class` (no `type`, como proponía el plan). `PostingLine.of(props)`, campos `accountId`, `amount: Money`, `metadata` (frozen), getter `currencyCode`, método `negated()`. Vive en `transactions/domain/posting/`, no en `shared-kernel`. |

### Money (dependencia base — EP-0.3, ya cerrada)

- `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\money\money.ts` —
  `Money.of(amount: string, currency: Currency)`, prohíbe `number` (INV-8), valida escala
  contra `currency.minorUnits`, `add/subtract/negate/isZero/isNegative/equals/compareTo/
  toDecimalString/toString`.
- `D:\Cristian\Nest\admin-back\apps\ledger\src\shared\domain\money\big.config.ts` —
  `Big.strict = true`, `Big.DP = 40`, `Big.RM = 2` (round-half-even), `PE`/`NE` en extremos
  para evitar notación exponencial.

### Envelope de eventos de dominio (AC-7 a AC-10)

| Artefacto | Path absoluto | Estado |
|---|---|---|
| `DomainEvent` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\domain\aggregate\domain-event.ts` | `abstract class`: `eventType`, `schemaVersion`, `toPayload(): EventPayload`. |
| `EventEnvelope` | `...\domain\event\event-envelope.type.ts` | `type` con `eventId, userId, aggregateType, aggregateId, sequence, eventType, schemaVersion, clientId, externalRef: Nullable<string>, payload, occurredAt, recordedAt`. |
| `StoredEvent` | `...\domain\event\stored-event.type.ts` | `type StoredEvent = EventEnvelope & { readonly globalPosition: bigint }`. |
| `EventPayload` | `...\domain\event\event-payload.type.ts` | `type EventPayload = Readonly<Record<string, unknown>>`. |
| `StreamId` | `...\domain\event\stream-id.type.ts` | `type StreamId = { userId, aggregateType, aggregateId }`. |
| `EventRegistry` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\event\event-registry.ts` | `abstract class`: `register(eventType, deserializer)` / `deserialize(eventType, schemaVersion, payload): DomainEvent`. Incluye implementación concreta `DomainEventRegistry` (map en memoria) y `UnknownEventTypeException`. |
| `EnvelopeFactory` | `D:\Cristian\Nest\admin-back\apps\ledger\src\shared-kernel\application\event\envelope.factory.ts` | `class` (no abstracta), `constructor(clock: Clock, idGenerator: IdGenerator)`, `build(stream, fromVersion, events, ctx: AuthContext): EventEnvelope[]`. Implementa anchor-only stamping de `externalRef` (solo primer evento del batch). |

### Convenciones confirmadas en código real

- Excepciones: `*.exception.ts` (o embebidas junto al VO) extendiendo
  `DomainUnprocessableException`/etc. con `readonly code: string` propio.
- Puertos: siempre `abstract class`, nunca `interface` — confirmado en `CurrencyCatalog`,
  `EventRegistry`, `DomainEvent`.
- Formas de datos puras: `type` en `*.type.ts` (`event-envelope.type.ts`, `stream-id.type.ts`,
  `auth-context.type.ts`, `command-result.type.ts`) — **excepto `PostingLine`**, que rompe el
  patrón (`class` en vez de `type`).
- JSDoc en inglés en todos los archivos leídos, cumpliendo CLAUDE.md.

### Primitivas de `libs/shared` reutilizables

- `Nullable<T>` → `D:\Cristian\Nest\admin-back\libs\shared\src\types\nullable.type.ts`
- `PropertiesOnly<T>` → `D:\Cristian\Nest\admin-back\libs\shared\src\types\properties-only.type.ts`
- Jerarquía de excepciones → `D:\Cristian\Nest\admin-back\libs\shared\src\exceptions\`:
  `domain.exception.ts` (`DomainException extends BaseException`, `status` abstracto),
  `domain-conflict.exception.ts`, `domain-unprocessable.exception.ts`,
  `domain-not-found.exception.ts`. Todos los VOs del ledger extienden
  `DomainUnprocessableException` con `code` propio (`InvalidAccountNameException`,
  `RootTypeImmutableException`, `InvalidCurrencyCodeException`, `UnknownCurrencyException`,
  `InvalidPayeeException`).
- `Criteria` → `D:\Cristian\Nest\admin-back\libs\shared\src\criteria\criteria.ts` (+
  `criteria-schema.ts`, `filter.ts`, `order.ts`, `criteria-from-query.ts`)
- Barrel público → `D:\Cristian\Nest\admin-back\libs\shared\src\index.ts`

### Documentación disponible

- `RESUMEN_EJECUTIVO.md` (raíz) — **no menciona `apps/ledger` en absoluto** (última
  actualización 2026-07-17, cubre solo `finances`/`users`/`exchanges`). Gap transversal, no
  específico de esta historia.
- `ledger-roadmap.md` (raíz) — checklist del roadmap; EP-1.1/EP-1.2 sin marcar `[x]` pese a
  estar implementados.
- `work/ledger/EP-1-nucleo.md` — plan de diseño original de EP-1.1/EP-1.2, con firmas
  propuestas (layout bajo `shared-kernel/` para todo, incl. `Currency` y `PostingLine` como
  `type`). El código real diverge en los dos puntos señalados arriba.
- `especificacion-tecnica-ledger.md` (raíz) — spec técnica original citada por la historia
  (§2.1, §2.1.1, §2.2, §2.3, §2.5, §2.7.1, RNF-2, RNF-6, INV-8, INV-9, INV-14); no releída en
  detalle porque `EP-1-nucleo.md` ya trae las firmas derivadas.

---

## Gaps detectados

1. **AC-7 — sin cobertura de tests para el round-trip de serialización (real, accionable):**
   falta `posting.serializer.spec.ts` y un spec dedicado para al menos un evento concreto
   (`transaction-recorded.event.spec.ts` u otro) que pruebe payload→evento→payload con montos
   en COP y USD preservando el valor exacto. Ningún `*.event.ts` bajo
   `transactions/domain/transaction/events/`, `accounts/domain/account/events/`,
   `reconciliation/domain/balance-assertion/events/` ni `ledger/domain/settings/events/` tiene
   spec propio — viola la regla de TDD estricto del proyecto. **Candidato principal para
   `/plan`.**
2. **Ubicación/composición de `Currency`** (AC-4): vive en `shared/domain/money/currency.ts`
   junto a `Money`, no en `shared-kernel/domain/value-objects/` como proponía el plan
   original; toma `code: string` en vez de `CurrencyCode`. Decisión de diseño a ratificar en
   `/design` — no es un defecto funcional.
3. **Forma de `PostingLine`** (AC-6): es `class` en `transactions/domain/posting/`, no `type`
   en `shared-kernel` como proponía el plan. Mismo tipo de decisión que el punto 2.
4. **`InvalidPayeeException`** (AC-3) está definida localmente en `payee.ts` en vez de en un
   `value-object.exception.ts` compartido — inconsistencia menor de organización, cosmética.
5. **`RESUMEN_EJECUTIVO.md`** no documenta `apps/ledger` — gap de documentación transversal
   (no bloqueante para esta historia, pero relevante si `/plan` incluye tareas de doc).
6. **`ledger-roadmap.md`** y **`work/ledger/EP-1-nucleo.md`** no reflejan que EP-1.1/EP-1.2
   están implementados — desactualizado.

**Confirmado sin gap:** el adaptador seed de `CurrencyCatalog` (AC-5) existe
(`seed-currency-catalog.ts`, `{ COP: 0, USD: 2 }` exacto, con spec propio) — descartado como
gap tras verificación directa.
