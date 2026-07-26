# hu-0008: Tooling de rebuild/replay + verificación de consistencia

## Historia de Usuario

**Como** desarrollador del núcleo del ledger (`apps/ledger`)
**Quiero** un `ProjectionRebuilder` que reconstruya cualquier proyección desde cero por
replay del stream, y un `ConsistencyVerifier` que compare los saldos derivados del stream
contra `proj_balances`
**Para** tener la garantía operativa de que el núcleo es reconstruible y auditable (RNF-5),
cerrando EP-1 con la certeza de que el stream y las proyecciones son consistentes

> Corresponde a **EP-1.12** del [roadmap del ledger](../../../ledger-roadmap.md), último paso
> del Apéndice B de `work/ledger/EP-1-nucleo.md` — cierre de la épica. Detalle técnico:
> `work/ledger/EP-1-nucleo.md` (sección EP-1.12). Depende de `hu-0004`/`hu-0006`
> (proyectores) y `hu-0007` (adaptadores Postgres, para el escenario de rebuild real).

## Criterios de Aceptación

### AC-1: `rebuild` reconstruye una proyección truncando y re-proyectando desde cero

`ProjectionRebuilder.rebuild(projectionName)` trunca el read model de esa proyección y su
checkpoint, y re-proyecta la totalidad del stream vía `EventStore.readAll` desde la posición
0. El estado resultante es idéntico al que produjo el dispatch incremental original.

### AC-2: `rebuild` de una proyección no afecta a las demás

Reconstruir una sola proyección (por ejemplo, `account_balances`) no trunca ni modifica el
contenido de las otras proyecciones (`account_tree`, `transaction_list`).

### AC-3: `rebuildAll` reconstruye todas las proyecciones y reporta el resultado

`rebuildAll()` reconstruye todas las proyecciones registradas y devuelve un `RebuildReport`
por cada una. El checkpoint de cada proyección reconstruida queda en la última posición del
stream.

### AC-4: `rebuild`/`truncate` + replay es idempotente

Ejecutar `rebuild` dos veces seguidas sobre la misma proyección produce el mismo estado final
ambas veces (no hay acumulación ni duplicación).

### AC-5: `ConsistencyVerifier` detecta drift exacto entre stream y proyección

`ConsistencyVerifier.verifyBalances(userId)` recalcula los saldos leyendo directamente el
stream (sin pasar por la proyección) y los compara contra `proj_balances` con **comparación
decimal exacta** (INV-8, sin tolerancia de punto flotante). Si coinciden, el reporte es OK. Si
una fila de `proj_balances` se corrompe manualmente, el verifier detecta y reporta la
diferencia exacta (drift), identificando cuenta y moneda afectadas.

### AC-6: El rebuild y la verificación nunca escriben en el `EventStore`

Tanto `ProjectionRebuilder` como `ConsistencyVerifier` **solo leen** del `EventStore`
(`readAll`); ninguno de los dos invoca `append` ni ninguna operación de mutación (INV-12).

## Reglas de Negocio

- El rebuild lee el stream, jamás lo edita (INV-12).
- La verificación de consistencia usa comparación decimal exacta — nunca una tolerancia
  numérica ni redondeo (INV-8).
- Snapshots de agregados quedan fuera de alcance en v1 (§6.3): se acepta el costo de replay
  completo dado que los agregados de este dominio tienen vida corta.
- `application/` (rebuilder, verifier) libre de NestJS/TypeORM; el adaptador CLI/driving
  (`rebuild.command.ts`) es la única pieza de infraestructura.
- TDD estricto.

## Fuera de Alcance

- Snapshots de agregados para acelerar rebuilds de streams muy largos — explícitamente
  diferido, no es parte de v1.
- Cualquier endpoint HTTP para disparar rebuild/verificación — se expone como CLI/script de
  Nx en este alcance, no como API (eso, si se necesita, es tema de EP-5 operabilidad).

## Technical Context

### Microservicio objetivo
- `apps/ledger`

### Artefactos a reutilizar
- `EventStore`, `EventRegistry` — de `hu-0002`
- `ReadModelStore`, `ProjectionCheckpointRepository`, todos los `Projector` registrados — de
  `hu-0004`/`hu-0006`
- Adaptadores Postgres — de `hu-0007` (para verificar el escenario real, no solo in-memory)

### Patrones obligatorios
- Adaptador driving tipo CLI (`nestjs-command` o script de Nx) para invocar rebuild/verify
- `application/` libre de NestJS/TypeORM
- TDD estricto

### Restricciones técnicas
- Sin snapshots de agregados en v1 — el rebuild siempre reprocesa el stream completo
- El rebuild y la verificación son de solo lectura respecto del `EventStore`

### Deuda técnica relevante
- Rebuild de streams muy largos no está optimizado (sin snapshots); aceptable dado el
  perfil de agregados de vida corta de este dominio — documentado como riesgo conocido, no
  como bug
