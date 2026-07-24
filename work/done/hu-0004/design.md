# design: hu-0004

> **Nota del scan:** Todos los artefactos descritos en `hu.md` (puertos `ReadModelStore`,
> `Projector`, `ProjectionDispatcher`, `ProjectionCheckpointRepository`; adaptadores
> `SynchronousProjectionDispatcher`, `PollingProjectionDispatcher`; dobles in-memory; proyector
> `AccountTreeProjector`; y derivador `TransactionKindDeriver`) **ya existen** en el código base
> como parte del flujo anterior (`hu-0001` a `hu-0003`). El entregable de esta historia es el
> **contract test reutilizable para `ReadModelStore`** (`describeReadModelStoreContract`) — mismo
> patrón que `describeEventStoreContract` en `hu-0002` — que verifica que cualquier
> implementación (in-memory y Postgres) satisface el contrato. No se introducen nuevos HTTP
> endpoints ni nuevas tablas de base de datos.

## Flujo entre microservicios

Flujo interno de `apps/ledger`: el `CommandHandler` persiste eventos vía
`EventSourcedRepository`, que tras cada `append` exitoso invoca al
`SynchronousProjectionDispatcher` para proyectar los eventos recién persistidos
en el `ReadModelStore` — todo dentro de la misma unidad de trabajo (read-your-writes,
RNF-9). El modo asíncrono (`PollingProjectionDispatcher`) lee desde el checkpoint global
y aplica el **mismo código de projector** de forma idempotente vía `upsert` por clave (AC-5).
El `ProjectionRebuilder` trunca las tablas del target, resetea el checkpoint y replaya el
stream completo para reconstruir proyecciones desde cero (RNF-5).

> Diagrama completo: `docs/diagram.md`.

## Componentes del módulo

El subsistema de proyecciones del `shared-kernel` queda formalizado con 4 puertos
abstractos (`ReadModelStore`, `Projector`, `ProjectionDispatcher`,
`ProjectionCheckpointRepository`), 6 adaptadores de infraestructura (`Synchronous-` y
`PollingProjectionDispatcher`, `InMemoryReadModelStore`, `PostgresReadModelStore`,
`InMemoryProjectionCheckpointRepository`, `ProjectionRebuilder`), y 1 contract test
reutilizable (`describeReadModelStoreContract`) en la capa de testing.

> Diagrama completo (C4 Nivel 3): `docs/component.md`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance es interno al módulo `shared-kernel` de `apps/ledger`: los puertos de
proyección y sus adaptadores ya existían en el código base; esta historia agrega
el contract test reutilizable que certifica el comportamiento. No se crean nuevos
apps, módulos, libs compartidas ni integraciones externas.

- **Nivel:** N/A
- **Cambio:** Ninguno
- **Nodo/arista concreto:** N/A

## Contratos (sin endpoints HTTP)

Esta historia no introduce ni modifica endpoints HTTP. El contrato formal es el **contract
test `describeReadModelStoreContract`**, que define el comportamiento esperado de cualquier
implementación de `ReadModelStore`:

| Operación | Contrato |
|-----------|----------|
| `upsert(table, key, row)` | Inserta o actualiza por clave; idempotente — repetir con misma clave no duplica filas (AC-4) |
| `delete(table, key)` | Elimina la fila identificada por clave |
| `query<TRow>(table, criteria)` | Filtra con `Criteria` (`@shared`), soporta todos los `FilterOperator`, ordena y pagina |
| `truncate(table)` | Vacía la tabla — insumo de rebuilds (RNF-5) |

El contract test debe ejecutarse idénticamente contra `InMemoryReadModelStore` y
`PostgresReadModelStore`, igual que `describeEventStoreContract` hace para el event store
(Artículo 1 de la constitución).

## Modelado de datos

No hay tabla nueva — `proj_accounts`, `proj_transactions`, `proj_postings`,
`proj_balances` y `proj_settings` ya existen como read models mantenidos por sus
respectivos projectors. El `ReadModelStore` es un puerto genérico que opera sobre
cualquier tabla de read model vía `upsert`/`delete`/`query`/`truncate`, sin acoplarse
a un esquema concreto.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | El contract test es la única adición; sigue el patrón ya establecido por `describeEventStoreContract` — sin nuevas capas, abstracciones ni proyectos. |
| Anti-Abstraction | ✅ | `ReadModelStore` es un puerto abstracto ya validado por la constitución (Artículo 1); el contract test usa Jest directamente, sin wrappers propios. |
| Integration-First | ✅ | El contrato (`describeReadModelStoreContract`) define el comportamiento esperado antes de cualquier implementación nueva — y valida las implementaciones ya existentes. |
| Test-First | ✅ | El contract test se escribe primero como spec ejecutable; las implementaciones existentes (`InMemoryReadModelStore`, `PostgresReadModelStore`) se validan contra él. Al no haber código de producción nuevo, el test actúa como verificación de conformidad de lo ya construido. |
