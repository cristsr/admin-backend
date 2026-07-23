# hu-0001: Value objects del dominio contable y envelope de eventos

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** contar con los value objects inmutables del dominio contable (`AccountName`,
`Payee`, `CurrencyCode`/`Currency`, `PostingLine`) y con el envelope de eventos de dominio
(`DomainEvent`, `EventEnvelope`, `StoredEvent`, `EventPayload`, `StreamId`, `EventRegistry`,
`EnvelopeFactory`)
**Para** que el resto del núcleo (agregados, `EventStore`, proyecciones) tenga un contrato
estable, inmutable y probado sobre el que construir, sin depender de infraestructura ni de
NestJS

> Corresponde a **EP-1.1 + EP-1.2** del [roadmap del ledger](../../../ledger-roadmap.md),
> primeras dos subtareas de EP-1 (Núcleo de dominio). Detalle técnico de referencia:
> `work/ledger/EP-1-nucleo.md` (secciones EP-1.1 y EP-1.2) y
> `especificacion-tecnica-ledger.md` (§2.1, §2.1.1, §2.2, §2.3, §2.5, §2.7.1, RNF-2, RNF-6,
> INV-8, INV-9, INV-14).

## Criterios de Aceptación

### AC-1: `AccountName` modela la jerarquía de cuentas por nombre

`AccountName` se construye a partir de un string jerárquico tipo `Assets:Bancolombia:Savings`
(segmentos separados por `:`). El primer segmento debe corresponder a uno de los 5 tipos raíz
(`ASSETS`, `LIABILITIES`, `INCOME`, `EXPENSES`, `EQUITY`); un segmento vacío, un separador
doble o una raíz inválida rechazan la construcción. Expone `rootType`, `value`, `parentName()`
(`null` en cuentas raíz), `isDescendantOf(other)` y `equals(other)`.

### AC-2: `AccountName.reparentFrom` conserva el tipo raíz (INV-14)

`reparentFrom(oldPrefix, newPrefix)` re-enraiza el nombre conservando la cola de segmentos
tras el prefijo, para soportar la propagación de renombres a descendientes. Si el nuevo
prefijo implica cambiar el tipo raíz, la operación **rechaza** (el tipo raíz es inmutable
durante toda la vida de la cuenta, INV-14).

### AC-3: `Payee` distingue contraparte de descripción libre

`Payee.of(raw)` normaliza recortando espacios (`trim`); un valor en blanco tras el trim
colapsa a `null` (no hay payee) en vez de construir un `Payee` vacío. El valor recortado no
puede superar los **255 caracteres**; un valor más largo rechaza la construcción.

### AC-4: `CurrencyCode` y `Currency` fijan la escala decimal de cada moneda

`CurrencyCode.of(raw)` normaliza a mayúsculas y rechaza código vacío. `Currency.of(code,
minorUnits)` asocia un código con su precisión (`minorUnits`), que `Money` usa para exigir
la escala correcta (INV-8): un monto con más decimales que los `minorUnits` de su moneda se
rechaza en la construcción del value object (§2.7.1).

### AC-5: `CurrencyCatalog` resuelve `minorUnits` con datos semilla

Existe un puerto `CurrencyCatalog` que resuelve `minorUnits` por código de moneda, sembrado
con `{COP: 0, USD: 2}` hasta que EP-4 introduzca el evento `CurrencyRegistered` y lo
reemplace por una proyección, sin tocar el núcleo. Pedir `minorUnits` de un código no
sembrado (ni COP ni USD) lanza una excepción de dominio tipada (consistente con la
jerarquía `DomainException` del proyecto) en vez de devolver un valor por defecto — evita
construir un `Money` con una escala inventada para una moneda no soportada aún.

### AC-6: `PostingLine` nunca existe sin moneda

`PostingLine` combina una referencia de cuenta (`accountId`), un `Money` (que ya porta su
moneda — nunca hay un monto sin moneda, §2.3 principio 9.4.1) y `metadata` de negocio
inmutable (`Readonly<Record<string, string>>`). Se construye directamente a partir de un
`Money` ya validado; no duplica la validación de escala que `Money` ya aplica.

### AC-7: `DomainEvent` serializa montos siempre como string decimal (RNF-2 / INV-8)

Todo `DomainEvent` implementa `toPayload()` produciendo un `EventPayload` JSON-safe donde
cada `Money` se serializa con su representación decimal en string (nunca `number`). Un
evento de prueba con montos en COP y en USD debe serializar y volver a deserializar
(round-trip payload → evento → payload) preservando el valor exacto.

### AC-8: El envelope de evento lleva la procedencia completa y es inmutable

`EventEnvelope`/`StoredEvent` son tipos inmutables (`readonly`, sin setters) que incluyen
`eventId`, `userId`, `aggregateType`, `aggregateId`, `sequence`, `eventType`,
`schemaVersion`, `clientId`, `externalRef` (nullable), `payload`, `occurredAt`, `recordedAt`
(y `globalPosition` en `StoredEvent`, asignado por el store). `userId` es obligatorio: no
existe construcción de un envelope sin él (INV-9).

### AC-9: `EnvelopeFactory` construye el envelope de forma determinista

`EnvelopeFactory` envuelve un `DomainEvent` junto con el `AuthContext` (userId, clientId,
externalRef) y usa `Clock`/`IdGenerator` para producir `eventId` y `recordedAt`. En tests con
Clock/IdGenerator deterministas, el envelope resultante es reproducible: `sequence`
correlativo, y `userId`/`clientId`/`externalRef` propagados exactamente desde el
`AuthContext`.

### AC-10: `EventRegistry` centraliza la deserialización y el upcasting (RNF-6)

`EventRegistry.register(eventType, deserializer)` registra un deserializador por tipo de
evento; `EventRegistry.deserialize(eventType, schemaVersion, payload)` reconstruye el
`DomainEvent` tipado correspondiente, aplicando upcasting cuando el `schemaVersion`
almacenado es anterior al vigente (por ejemplo, un evento de prueba versión 1 se upcastea a
versión 2 sin migrar datos in situ). Un `eventType` desconocido lanza un error tipado.

## Reglas de Negocio

- Todo value object es inmutable: sin setters, construcción únicamente por factories
  estáticas con guard clauses (rechazo temprano de estados inválidos).
- Ningún archivo de `domain/` ni `application/` importa `@nestjs/*` ni `typeorm`; estos value
  objects y el envelope son código de núcleo puro (RNF-11).
- Ningún monto de dinero se representa como `number` en ninguna capa del núcleo: siempre
  `Money` en memoria, siempre string decimal en payloads/DTOs (RNF-2, INV-8).
- Los enums de este alcance (`AccountType`, tipos de evento) viven solo en la capa de
  aplicación — nunca como enum de base de datos (regla del proyecto).
- Cada archivo de producción se precede por su `*.spec.ts` (TDD estricto).

## Resolución de Ambigüedades

- **AC-3:** ¿Cuál es el largo máximo permitido para `Payee`? → 255 caracteres (default de
  varchar en TypeORM/Postgres; consistente con el campo `merchant` sin longitud explícita en
  `apps/finances`).
- **AC-5:** ¿Qué hace `CurrencyCatalog.minorUnits()` ante un código no sembrado antes de
  EP-4? → Lanza una excepción de dominio tipada (falla rápido en vez de inventar una escala).

## Fuera de Alcance

- El puerto `EventStore` y sus adaptadores (in-memory/Postgres) — EP-1.3/EP-1.4/EP-1.5.
- Los agregados `Account` y `LedgerTransaction` — EP-1.6/EP-1.7.
- El command bus, las proyecciones y el query bus — EP-1.8 a EP-1.11.
- El evento `CurrencyRegistered` y su proyección — diferido a EP-4.2.

## Technical Context

### Microservicio objetivo
- `apps/ledger` (app nueva, event sourcing + CQRS + partida doble)

### Artefactos a reutilizar
- `Money` — value object decimal de `@shared` (entregado por EP-0.3), `Big.strict = true`
- `Nullable<T>` — de `@shared`
- `Criteria` — de `@shared`
- Jerarquía `DomainException` (`DomainConflictException` / `DomainUnprocessableException` /
  `DomainNotFoundException`) — de `@shared`
- `PropertiesOnly` — de `@shared`

### Patrones obligatorios
- Puertos como `abstract class`, nunca `interface`
- `domain/` y `application/` libres de `@nestjs/*` y `typeorm` (RNF-11); NestJS solo en
  `infrastructure/` y módulos
- Value objects inmutables (`readonly`, sin setters), construidos por factories estáticas con
  guard clauses
- TDD estricto: cada archivo de producción precedido por su `*.spec.ts`
- Comentarios en inglés + JSDoc en clases, métodos y tipos exportados (CLAUDE.md)
- Enums de este alcance viven solo en la capa de aplicación, nunca como enum de DB

### Restricciones técnicas
- No se reutiliza el dominio de `finances` (`movement`, `account`, `category`, `transfer`,
  `summary`): paradigma incompatible (event sourcing vs. CRUD)
- `Money` nunca se construye desde `number` (INV-8); los montos viajan como string decimal en
  payloads/DTOs
- `finances` no se toca en este alcance

### Deuda técnica relevante
- Ninguna en este alcance — `apps/ledger` es una app nueva sin código previo; depende de que
  EP-0.3 (`Money` decimal en `@shared`) ya esté cerrado (lo está, ver roadmap)
