# design: hu-0015

## Decisiones de Diseño

`/scan` no dejó marcadores `[NEEDS CLARIFICATION]`, pero sí destapó dos hechos que
obligaron a decidir sin poder preguntar (la ejecución fue pedida como automática). Ambas
decisiones están razonadas en [`docs/research.md`](./docs/research.md) con sus alternativas:

- **Escritura por el `ReadModelStore` genérico:** los projectors escriben con
  `store.upsert(table, key, row)` y los puertos `AssertionStatusStore`/`AdjustmentAuditStore`
  pierden sus métodos de escritura, quedando como puertos de **lectura** — es la única
  forma de cumplir el contrato `Projector` y que `ProjectionRebuilder` pueda truncar.
- **Una sola proyección `reconciliation` con dos projectors:** `AdjustmentAuditProjector`
  lee `proj_assertions`, así que ambas comparten checkpoint y orden. Registrarlas por
  separado permitiría un `rebuild adjustment_audit` aislado que produce un audit incorrecto
  en silencio.
- **Projectors movidos a `infrastructure/projections/`:** el Artículo 1 prohíbe `@nestjs/*`
  en `application/`, y ambos están hoy en `application/projectors/` con `@Injectable()`.
- **`PostgresProjectionCheckpointRepository` nuevo:** la tabla `projection_checkpoints`
  existe desde `1790000000002` pero nunca se usó; sin ella el pump reprocesa el stream
  entero en cada arranque.
- **El pump se dispara periódicamente (`@nestjs/schedule`):** `pump()` no lo llamaba nadie
  en producción. Sin disparador, la historia entrega tablas Postgres que nadie llena y el
  *Para* de la historia no se puede cumplir. **Excede el texto literal de los AC** — ver
  «Excepciones» al final.
- **El pump conserva el orden proyectar → reaccionar:** un único bucle con un único
  checkpoint, en vez de dos pollers independientes que permitirían al reactor adelantarse a
  las proyecciones.

## Flujo entre módulos

El pump de conciliación lee el stream global desde su checkpoint persistido, aplica
`AssertionStatusProjector` y `AdjustmentAuditProjector` sobre el `ReadModelStore` de
Postgres, y recién entonces alimenta a `ReevaluateAssertionsReactor`, que despacha
`EvaluateAssertion` por el `CommandBus`. Las mismas dos clases, sin cambios, son las que
`ProjectionRebuilder` ejecuta para reconstruir las tablas desde cero.

Flujos afectados (todos `create` — el módulo no tenía documentación previa):

| Caso de uso | Op | Trigger | Entrypoint | Doc |
|---|---|---|---|---|
| Proyectar `assertion_status` | create | domain-event | `BalanceAsserted`/`Evaluated`/`Revoked`/`DiscrepancyResolved` | [project-assertion-status](./docs/flows/project-assertion-status.md) |
| Proyectar `adjustment_audit` | create | domain-event | `DiscrepancyResolved` | [project-adjustment-audit](./docs/flows/project-adjustment-audit.md) |
| Bombear el stream | create | cron | `ReconciliationPump.pump()` | [run-reconciliation-pump](./docs/flows/run-reconciliation-pump.md) |

## Componentes del módulo

Esta historia no agrega comportamiento de negocio: **realinea** los componentes existentes
con los contratos del kernel. `AssertionStatusProjector` y `AdjustmentAuditProjector` pasan
a extender `Projector` y se mudan a `infrastructure/projections/`; los dos puertos de store
se reducen a lectura y ganan adaptadores sobre `ReadModelStore`; se agregan
`PostgresProjectionCheckpointRepository` (shared-kernel) y el disparador periódico del
pump. Delta completo en [`docs/model.delta.c4`](./docs/model.delta.c4).

## Impacto en Arquitectura Global

**¿Toca arquitectura global?** Sí.

- **Nivel:** Container (Nivel 2).
- **Cambio:** nuevo módulo dentro de un app existente. `admin.ledger.reconciliation` no
  está declarado en `docs/architecture/landscape.c4` (que hoy sólo modela
  `admin.ledger.shared`) ni tiene `.c4` propio en `apps/ledger/docs/`.
- **Nodo/arista concreto:** agregar el módulo `reconciliation = module 'Reconciliation'`
  dentro de `admin.ledger`, con la relación
  `admin.ledger.reconciliation -> admin.ledger.shared.eventStore 'lee el stream global'`.
  Los componentes internos (C4 Nivel 3) van en
  `apps/ledger/docs/reconciliation/reconciliation.c4`, no en el landscape.

## Contratos por módulo

**No hay delta de API.** Esta historia no agrega, quita ni cambia ningún endpoint: los
cinco de `BalanceAssertionController` (`POST /v1/balance-assertions`, `.../{id}/revoke`,
`.../{id}/resolve`, `GET .../{id}`, `GET /v1/balance-assertions`) conservan su contrato
exacto. Cambia de dónde leen sus datos, no qué devuelven. Por eso no se generó
`docs/api.delta.yaml` — el contrato REST del módulo lo documenta hu-0017.

## Modelado de datos

Migración renumerada `1784160000010` → `1790000000005`, sin `proj_transfer_candidates`.
Las tres tablas de conciliación conservan sus columnas (verificadas contra las filas que
emiten los projectors) y `projection_checkpoints` pasa a usarse por primera vez.

> Detalle completo: [`docs/data-model.md`](./docs/data-model.md).

## Validación de Quality Gates

| Gate | Resultado | Justificación |
|------|-----------|---------------|
| Simplicity | ✅ | No agrega capas: elimina dos stores bespoke y reusa `Projector`, `ReadModelStore` y `ProjectionCheckpointRepository`, que ya existen. El único componente nuevo es el adaptador Postgres de un puerto ya definido. |
| Anti-Abstraction | ✅ | Usa `@nestjs/schedule` directo para el disparo, sin envolverlo; y el `ReadModelStore` directo en vez de mantener dos puertos ricos que duplicaban su rol. |
| Integration-First | ✅ | Los contract tests se escriben antes que los adaptadores: `runAssertionStatusStoreContract` ya existe y se extiende al adaptador nuevo; para `AdjustmentAuditStore` se crea la suite primero (AC-3). |
| Test-First | ✅ | `/plan` ordena las tareas TDD: contract suite y specs de projector antes de tocar los adaptadores. |

### Artículos verificados

- **Artículo 1 (núcleo aislado):** la historia **corrige** una violación vigente — los dos
  projectors importan `@nestjs/common` desde `application/`.
- **Artículo 10 (CQRS estricto):** refuerza el artículo — un único escritor por read model,
  a través de un único puerto; el reactor sigue sin escribir.
- **Artículo 5 (aislamiento por usuario):** las tres tablas conservan `user_id` en su clave
  o en sus índices; las lecturas siguen filtrando por usuario.
- **Artículo 7 (dinero sin float):** los montos se materializan en `numeric(20,6)` y la
  aritmética sigue en `Money`; el projector no hace cuentas, sólo copia strings decimales.

## Excepciones a la constitución

Ninguna. Pero sí una **desviación de alcance respecto al texto de los AC**, declarada acá
para que se apruebe explícitamente:

- **Disparo periódico del pump:** ningún AC lo pide literalmente. Se incluye porque
  `pump()` no tiene call-site de producción, y sin él AC-8 sólo se puede verificar
  invocando el comando de rebuild a mano — la conciliación seguiría sin funcionar en la app
  real. Si se prefiere dejarlo fuera, sale de esta historia sin afectar AC-0 a AC-7, y las
  tablas quedan correctas pero vacías hasta que otra historia cablee el disparador.
- **AC-6 se cumple con una sola entrada de registro** (`reconciliation`) en vez de dos
  (`assertion_status`, `adjustment_audit`). El fin del criterio —que el rebuild las
  alcance— se cumple; la razón está en `docs/research.md`.
