# research: hu-0015

## Decisión: los projectors escriben por el `ReadModelStore` genérico, no por un puerto rico

- **Contexto:** `AssertionStatusProjector` y `AdjustmentAuditProjector` escriben hoy a
  puertos ricos (`AssertionStatusStore.upsertAsserted/applyEvaluation/markRevoked/…`,
  `AdjustmentAuditStore.record`). El contrato `Projector` del kernel impone
  `project(event: StoredEvent, store: ReadModelStore)`, y `ProjectionRebuilder` trunca por
  **nombre de tabla** a través del `ReadModelStore`. Un projector que escribe por otro
  puerto es invisible para el rebuilder.
- **Opciones evaluadas:**
  1. **Projectors sobre `ReadModelStore`; los puertos ricos quedan solo de lectura.**
     Pros: cumple el contrato, el rebuild funciona, un único escritor de read models
     (Artículo 10), consistente con `AccountTreeProjector`/`TransactionListProjector`/
     `AccountBalancesProjector`. Contras: las actualizaciones parciales (`applyEvaluation`,
     `markRevoked`, `linkResolution`) pasan a ser `upsert` con subconjunto de columnas.
  2. **Mantener los puertos ricos y adaptar el contrato `Projector`** (p. ej. genéricos o
     un segundo parámetro opcional). Pros: no toca los projectors. Contras: cambia una
     abstracción compartida por los cuatro projectors sanos para acomodar a dos que están
     mal; el rebuilder seguiría sin poder truncar.
  3. **Puerto rico implementado sobre `ReadModelStore`, inyectado en el projector.** Pros:
     conserva los nombres de método. Contras: el projector recibiría `store` por el
     contrato y usaría otro por constructor — dos caminos de escritura al mismo read model,
     exactamente lo que el Artículo 10 prohíbe.
- **Elegida:** opción 1 — es la única que satisface AC-0, AC-1 y AC-6 a la vez.
- **Descartadas por:** 2 degrada una abstracción sana; 3 duplica el camino de escritura.

**Verificación previa — corregida durante el build.** La primera lectura fue que un
`upsert` parcial bastaba, porque `PostgresReadModelStore` genera
`INSERT … ON CONFLICT (<key>) DO UPDATE SET <solo las columnas provistas>`. Es cierto para
ese adaptador, **pero no es la semántica del puerto**: el contrato compartido
(`read-model-store.contract.ts`) declara *"overwrites a row on repeated upsert with the
same key"*, e `InMemoryReadModelStore` la implementa literalmente — reemplaza la fila
entera. Un upsert parcial daría resultados distintos en cada adaptador, que es exactamente
lo que los contract tests existen para impedir.

**Consecuencia:** los projectors hacen **leer → mezclar → escribir la fila completa**.
`BalanceAssertionEvaluated` lee la fila de la aserción, le aplica `status`, `difference` y
`checked_at`, y la reescribe entera. Es el mismo patrón que ya usa `AccountTreeProjector`
para propagar un renombre, y se comporta idéntico en ambos adaptadores.

---

## Decisión: una sola proyección registrada con dos projectors

- **Contexto:** `AdjustmentAuditProjector` **lee** la fila de la aserción resuelta para
  obtener `difference`, `accountId` y `currencyCode`. Es una dependencia de orden entre dos
  read models: `adjustment_audit` necesita que `assertion_status` ya haya aplicado el
  `BalanceAssertionEvaluated` anterior.
- **Opciones evaluadas:**
  1. **Una entrada `reconciliation` con ambos projectors y las tres tablas.** Pros:
     comparten checkpoint y se aplican en orden dentro del mismo `PollingProjectionDispatcher`;
     un `rebuild reconciliation` reconstruye el conjunto coherente. `ProjectionRegistry.register`
     ya acepta `readonly Projector[]`. Contras: no se puede reconstruir una sola de las dos.
  2. **Dos entradas independientes** (`assertion_status`, `adjustment_audit`). Pros: literal
     respecto al texto de AC-6; granularidad fina. Contras: `rebuild adjustment_audit`
     aislado leería un `proj_assertions` en estado arbitrario y produciría un audit
     incorrecto en silencio.
- **Elegida:** opción 1. AC-6 pide que el rebuild las alcance; una entrada que reconstruye
  ambas cumple el fin del criterio, y la opción 2 introduce un modo de fallo silencioso.
- **Descartadas por:** granularidad que rompe correctitud no es granularidad útil.

---

## Decisión: mover los projectors de `application/` a `infrastructure/`

- **Contexto:** el **Artículo 1** de la constitución prohíbe que `domain/` y `application/`
  de `apps/ledger` importen `@nestjs/*`. Ambos projectors viven en
  `reconciliation/application/projectors/` y están decorados con `@Injectable()` de
  `@nestjs/common` — violan el artículo hoy.
- **Opciones evaluadas:**
  1. **Mover a `reconciliation/infrastructure/projections/` y quitar `@Injectable`.** Es
     donde viven los cuatro projectors sanos (`accounts/infrastructure/projections/`,
     `transactions/infrastructure/projections/`), ninguno de los cuales importa NestJS.
  2. Dejarlos donde están y solo quitar el decorador. Resuelve el artículo pero deja la
     estructura del módulo distinta de la de los otros tres sin razón.
- **Elegida:** opción 1 — alinea con el resto del repositorio y corrige la violación.
- **Descartadas por:** 2 arregla el síntoma y conserva la inconsistencia.

---

## Decisión: adaptador Postgres de `ProjectionCheckpointRepository`

- **Contexto:** la tabla `projection_checkpoints` existe desde la migración
  `1790000000002`, pero la única implementación del puerto es
  `InMemoryProjectionCheckpointRepository`. El pump de conciliación ni siquiera usa el
  puerto: guarda `private checkpoint = 0n` en una propiedad.
- **Opciones evaluadas:**
  1. **Escribir `PostgresProjectionCheckpointRepository`** sobre la tabla existente.
     Pros: persiste la posición entre reinicios; el pump reanuda donde quedó; habilita
     medir el lag de proyección (RNF-12, insumo de hu-0022). Contras: un adaptador más.
  2. Seguir con el checkpoint en memoria. Contras: cada arranque reprocesa el stream
     completo. Es idempotente, así que no corrompe, pero es O(n) por arranque y hace que
     "persistir la proyección" sea una media verdad: la tabla sobrevive, la posición no.
- **Elegida:** opción 1 — sin ella, AC-1 entrega tablas persistentes que se recalculan
  enteras en cada arranque.
- **Descartadas por:** 2 contradice el *Para* de la historia.

---

## Decisión: el pump se dispara solo (fuera del texto de los AC, dentro de su intención)

- **Contexto:** `grep -rn "\.pump()" src` no devuelve ningún call-site de producción.
  `ReevaluateAssertionsEventHandler` está registrado como provider en
  `ReconciliationModule` pero **nadie lo ejecuta**: hoy las proyecciones de conciliación
  nunca se construyen en la app real y el reactor de re-evaluación nunca corre. Migrarlas a
  Postgres sin resolver esto cambia dónde está el vacío, no lo llena.
- **Opciones evaluadas:**
  1. **Disparo periódico con `@nestjs/schedule`** (ya es dependencia directa del repo), en
     un adaptador de infraestructura del módulo. Pros: cumple lo que la spec §8.1 prescribe
     para estas dos proyecciones ("poller propio con checkpoint"); hace observable AC-8 en
     operación normal, no solo por comando de rebuild. Contras: agrega un disparador que
     ningún AC pide literalmente.
  2. Dejarlo sin disparar y abrir una historia aparte. Pros: alcance mínimo. Contras: la
     historia entrega tablas Postgres que nadie llena — el *Para* ("que el estado de
     conciliación sobreviva a un reinicio") no se puede cumplir si nunca hay estado.
  3. Proyección síncrona en la transacción del command. Contras: contradice §8.1, que las
     clasifica explícitamente como asíncronas, y acopla la latencia del command a la
     conciliación.
- **Elegida:** opción 1.
- **Descartadas por:** 2 deja la historia sin efecto observable; 3 contradice la spec.

**Nota de alcance:** este punto excede el texto literal de los AC. Se documenta acá y en
`design.md` para que quede explícito en la revisión.

---

## Decisión: el pump conserva el orden proyecciones → reactor

- **Contexto:** `PollingProjectionDispatcher` aplica projectors y avanza checkpoint, pero
  no ejecuta reactors. El pump actual garantiza, por diseño documentado, que cada evento
  primero actualice las proyecciones y después alimente al reactor, "so a reactor lookup
  always reads a current `assertion_status`".
- **Opciones evaluadas:**
  1. **Conservar `ReevaluateAssertionsEventHandler` como el pump del módulo**, refactorizado
     para usar `ProjectionCheckpointRepository` y llamar a los projectors con
     `(event, readModelStore)`. Pros: preserva la garantía de orden con un checkpoint único.
  2. Un `PollingProjectionDispatcher` para las proyecciones y otro poller para el reactor.
     Contras: dos checkpoints independientes; el reactor podría adelantarse a las
     proyecciones y consultar un `assertion_status` desactualizado — reintroduce
     exactamente el bug que el diseño actual evita.
- **Elegida:** opción 1.
- **Descartadas por:** 2 rompe una garantía de correctitud a cambio de reusar una clase.
