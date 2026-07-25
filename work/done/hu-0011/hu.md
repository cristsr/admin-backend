# hu-0011: Códigos de error de dominio estables (RF-14) vía exception filter

## Historia de Usuario

**Como** consumidor del API del ledger (frontend, sistema de correos)
**Quiero** que todo fallo de dominio o de puerto se reporte con un código estable y accionable
y un status HTTP consistente, con un cuerpo de error uniforme
**Para** poder reaccionar programáticamente a cada condición de error (RF-14) sin acoplarme a
mensajes de texto ni a detalles internos de la implementación

> Corresponde a **EP-2.6** del [roadmap del ledger](../../../ledger-roadmap.md).
> Detalle técnico: `work/ledger/EP-2-api.md` (sección EP-2.6). Depende de la jerarquía de
> excepciones de EP-1 (agregados de `hu-0003` + puerto `EventStore` de `hu-0002`/`hu-0007`) y
> del andamiaje HTTP (`hu-0009`).

## Criterios de Aceptación

### AC-1: Filter global de `libs/shared` registrado

`main.ts` registra global el `ExceptionFilter` de `libs/shared`, que lee `exception.code` y
`exception.status` de cualquier `DomainException` y produce el `ErrorResponseBody`
(`{ statusCode, error, message, code, path, timestamp }`). No se escribe un filter nuevo.

### AC-2: Mapeo estable de códigos de agregado → HTTP

Cada excepción de agregado se mapea a su código y status estables:
`UNBALANCED_TRANSACTION`→422, `CURRENCY_NOT_ALLOWED`→422, `ACCOUNT_CLOSED`→409,
`IMMUTABLE_TRANSACTION`→409, `NAME_COLLISION`→409, `SYSTEM_ACCOUNT_PROTECTED`→409,
`LEDGER_NOT_INITIALIZED`→409, `TRANSACTION_NOT_FOUND`/`ACCOUNT_NOT_FOUND`→404.

### AC-3: Excepciones de puerto dentro de la jerarquía `DomainException`

`CONCURRENCY_CONFLICT`→409 y `DUPLICATE_EXTERNAL_REF`→409, originadas en el puerto
`EventStore`, extienden la jerarquía `DomainException` (o una `LedgerConflictException`
equivalente) para que el **mismo** filter las mapee, sin un `catch` especial.

### AC-4: Fuente única de códigos (`LEDGER_ERROR_CODE`)

Existe un `LedgerErrorCode` (enum/const) como fuente única de los strings RF-14, compartido
entre las excepciones y los tests, evitando drift entre el código emitido y el contrato.

### AC-5: Contract test tabular que congela el mapeo

Un contract test recorre la tabla y, por cada `code`, lanza la excepción a través del filter y
afirma `{ statusCode, code }` esperados (espejo de
`libs/shared/src/filters/exception.filter.spec.ts`). Agregar un `code` nuevo obliga a
actualizar la tabla y su test.

### AC-6: Errores desconocidos no filtran códigos de dominio

Un error no tipado se mapea a `500` sin exponer un `code` de dominio ni detalles internos.

### AC-7: Distinción idempotencia vs. colisión real

Un *replay* del mismo command con el mismo `external_ref` **no** es un error (lo resuelve
`hu-0012`/EP-1 devolviendo el resultado original); `DUPLICATE_EXTERNAL_REF` (409) se reserva
para el caso patológico de mismo `external_ref` con un command distinto/conflictivo. Esta HU
solo garantiza que ese caso patológico se traduce a 409.

## Reglas de Negocio

- **RF-14**: todo fallo de dominio/puerto responde con un `code` estable de la tabla y su
  status HTTP; el cuerpo sigue `ErrorResponseBody`.
- **422** para violaciones semánticas del payload reprocesables corrigiéndolo (desbalance,
  moneda no permitida).
- **409** para conflictos de **estado** del agregado/stream (cuenta cerrada, transacción
  inmutable, colisión de nombre, cuenta de sistema protegida, concurrencia, `external_ref` en
  colisión real).
- El status de un `code` existente es contrato estable: cambiarlo es breaking (nueva versión);
  agregar un `code` nuevo es aditivo.
- Reuso de plataforma: se reutiliza `ExceptionFilter`, la jerarquía `DomainException` y
  `ErrorResponseBody` de `libs/shared`; no se reinventa la maquinaria.
- TDD estricto.

## Fuera de Alcance

- La autoría de las excepciones de agregado (viven en EP-1); esta HU define y **congela** su
  mapeo estable como contrato del API, y aporta el contract test.
- Los errores `400` de forma (`ValidationPipe`) y `401` de contexto (`hu-0010`): quedan
  documentados en la tabla pero su lógica pertenece a otras piezas.

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `libs/shared/src/filters/exception.filter.ts` y su `exception.filter.spec.ts` (patrón).
- `libs/shared/src/filters/error-response-body.type.ts`.
- Jerarquía `DomainException` → `DomainConflictException` (409),
  `DomainUnprocessableException` (422), `DomainNotFoundException` (404).
- Excepciones de agregado de `hu-0003` y de puerto de `hu-0002`/`hu-0007`.

### Artefactos a crear
- Registro del filter global en `apps/ledger/src/main.ts`.
- `apps/ledger/src/shared-kernel/infrastructure/adapters/http/error-codes.ts`
  (`LEDGER_ERROR_CODE` como fuente única).
- Contract test tabular del mapeo `code` → `{ statusCode }`.
- (En EP-1, referenciado) que las excepciones expongan el `code` de la tabla.

### Patrones obligatorios
- Un solo filter global; sin `catch` especiales por familia de excepción.
- Todas las excepciones del ledger (incluidas las de puerto) extienden `DomainException`.
- TDD estricto.

### Restricciones técnicas
- Coordinar con EP-1 para que `CONCURRENCY_CONFLICT` y `DUPLICATE_EXTERNAL_REF` estén tipadas
  dentro de la jerarquía `DomainException`, evitando un `catch` especial en el filter.
