# design: hu-0008

## Decisiones de Diseño

- **`ProjectionRegistry` en `application/`:** Clase concreta que mapea nombres de proyección a
  `{ projectors, tables }`. Permite que `rebuild(projectionName)` resuelva por nombre sin
  acoplar el rebuilder a módulos concretos. Vive en `application/` porque no depende de
  infraestructura — es un `Map` puro. Ver `docs/research.md` para análisis completo.
- **Nx executor script sobre nestjs-command:** El CLI de rebuild/verify es un script standalone
  ejecutado vía `ts-node`/Nx executor, no un comando NestJS. `application/` permanece libre de
  NestJS (Artículo 1) y no se agrega ninguna dependencia nueva. Ver `docs/research.md`.
- **Verificador recalcula desde eventos del stream:** `ConsistencyVerifier.verifyBalances(userId)`
  deserializa eventos con `EventRegistry` y acumula saldos con `Money` exacto, sin depender de
  `proj_postings`. Esto verifica independientemente la corrección del proyector de balances.
  Ver `docs/research.md`.

## Flujos afectados

| Slug | Acción | Trigger | Entrypoint |
|------|--------|---------|------------|
| `rebuild-projection` | create | cli | `nx run ledger:rebuild --projection <name>` |
| `rebuild-all` | create | cli | `nx run ledger:rebuildAll` |
| `verify-balances` | create | cli | `nx run ledger:verify-balances --userId <uuid>` |

> Detalle completo de cada flujo: `docs/flows/`. Diagramas: `docs/model.delta.c4` (vistas
> dinámicas `shared_kernel_rebuild_projection`, `shared_kernel_rebuild_all`,
> `shared_kernel_verify_balances`).

## Componentes del módulo

Nuevos en `shared-kernel`:

| Capa | Componente | Propósito |
|------|-----------|-----------|
| Application | `ProjectionRegistry` | Registro nombre → `{ projectors, tables }` |
| Application | `ConsistencyVerifier` | Verifica `proj_balances` contra el stream |
| Application | `RebuildReport` (type) | Resultado de `rebuildAll()` |
| Application | `BalanceVerificationReport` (type) | Resultado de `verifyBalances()` |
| Infrastructure | CLI script (`rebuild.command.ts`) | Punto de entrada Nx executor |

Modificado:

| Capa | Componente | Cambio |
|------|-----------|--------|
| Application | `ProjectionRebuilder` | Constructor acepta `ProjectionRegistry`; nuevo `rebuild(projectionName)` y `rebuildAll()` |

> Diagrama C4 Nivel 3 (delta): `docs/model.delta.c4`. El modelo completo del módulo se reconcilia
> en `/sync` contra `apps/ledger/docs/shared-kernel/shared-kernel.c4`.

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** No.

El alcance es interno al módulo `shared-kernel` de `apps/ledger`: se agregan componentes de
aplicación (`ProjectionRegistry`, `ConsistencyVerifier`, tipos de reporte) y se modifica el
`ProjectionRebuilder` existente. No se crea ningún app, módulo, lib compartida ni integración
externa nueva. El CLI script es infraestructura interna del ledger.

## Contratos por microservicio

### apps/ledger

No hay endpoints REST en esta historia — todos los flujos son CLI (`trigger: cli`). No se
genera `docs/api.yaml`.

## Modelado de datos

No hay tablas nuevas — todas las operaciones son de solo lectura sobre `event_store` y
`proj_*` existentes. No se genera `docs/data-model.md`.

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | `ProjectionRegistry` es la única abstracción nueva, y su caso de uso es inmediato (resolver por nombre, requerido por AC-1). Sin capas extra ni indirección. |
| Anti-Abstraction | ✅ | `ProjectionRegistry` es una clase concreta (`Map`), no un puerto abstracto. El CLI usa `ts-node` directamente sin wrapper. No se envuelven librerías. |
| Integration-First | ✅ | No hay endpoints REST que contratar; los 3 flujos CLI están documentados con frontmatter y prosa en `docs/flows/`. El contrato de eventos es el `StoredEvent` existente. |
| Test-First | ✅ | `/plan` escribirá tests antes del código de producción (Artículo 4). Los tests cubrirán `ProjectionRegistry`, `ConsistencyVerifier.verifyBalances`, `rebuild(projectionName)` y `rebuildAll()`. |
