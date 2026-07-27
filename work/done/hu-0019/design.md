# design: hu-0019

## Decisiones de Diseño

- **Catálogo global** (elegido por el usuario): una moneda es dato de referencia universal.
  Excepción consciente al Artículo 5, acotada a datos de referencia.
- **`minorUnits` entre 0 y 4** (elegido): el rango de ISO-4217.
- **Re-registro idempotente si es idéntico, rechazo si difiere** (elegido): cambiar la
  precisión reinterpretaría montos históricos (principio #5).
- **`resolve` conserva su firma síncrona.** Es la restricción que gobierna todo: lo
  consumen 22 archivos, incluida la deserialización de eventos con montos
  (`BalanceAsserted.fromPayload` y compañía). El adaptador nuevo lee la proyección pero
  sirve desde una caché en memoria; volverlo asíncrono rompería la rehidratación de todo
  agregado con dinero.
- **`userId` de sistema reservado para el stream del catálogo.** Consecuencia técnica de
  la decisión anterior, no una decisión nueva: `StreamId` exige `userId` y el `EventStore`
  filtra por él en `load` y `findByExternalRef` (INV-9). Un stream global se estampa con un
  UUID de sistema constante y declarado. La excepción a INV-9 es la misma que la del
  Artículo 5 que AC-2 ya asumió, no una segunda.
- **Las monedas ISO base viven en el adaptador, no en una migración.** Insertar COP y USD
  en `proj_currencies` por migración las borraría el primer `rebuild currencies`: el
  rebuild trunca la tabla y la reconstruye desde el stream, donde esos eventos no existen.
  El adaptador resuelve primero contra la proyección y cae al conjunto base si no
  encuentra; así COP y USD sobreviven a cualquier rebuild y a un catálogo vacío (AC-8).

## Flujo

`POST /v1/currencies` → `RegisterCurrencyCommand` → el agregado del catálogo verifica el
rango de `minorUnits` y si el código ya existe con la misma precisión (no-op) o con otra
(rechazo); emite `CurrencyRegistered`. El projector materializa `proj_currencies`, y
`ReadModelCurrencyCatalog` refresca su caché para que el próximo `resolve` síncrono vea la
moneda nueva. `GET /v1/currencies` lista desde la proyección.

| Caso de uso | Op | Trigger | Entrypoint |
|---|---|---|---|
| Registrar una moneda | create | rest | `POST /v1/currencies` |
| Listar monedas | create | rest | `GET /v1/currencies` |

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** Sí.

- **Nivel:** Container (Nivel 2)
- **Cambio:** nuevo módulo `reference` dentro de `admin.ledger`
- **Nodo/arista concreto:** módulo `reference = module 'Reference'` con la arista
  `admin.ledger.reference -> admin.ledger.shared.readModel 'proj_currencies'`. Los
  componentes internos van en `apps/ledger/docs/reference/reference.c4`.

## Modelado de datos

Tabla `proj_currencies` nueva: `code` (PK), `minor_units`, `name`, `registered_at`. Sin
`user_id` — es global. Migración `1790000000006`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | Un agregado plano sin invariantes ricos (§3.3 lo pide así), un projector, un adaptador con caché. No se toca el puerto ni sus 22 consumidores. |
| Anti-Abstraction | ✅ | Reusa `CurrencyCatalog` tal cual, que fue diseñado para este reemplazo — su JSDoc lo anticipa literalmente. |
| Integration-First | ✅ | El contrato del catálogo ya existe y no cambia; el del endpoint se define antes del handler. |
| Test-First | ✅ | El test del adaptador con caché y el del agregado preceden a la implementación. |

## Excepciones a la constitución

- **Artículo 5 (aislamiento por usuario):** el catálogo es global y su stream usa un
  `userId` de sistema. Justificación: es dato de referencia universal, no dato de negocio
  de un usuario. Aprobado explícitamente por el usuario al elegir el alcance global.
