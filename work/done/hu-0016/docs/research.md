# research: hu-0016

## Decisión: solo `TransactionVoided` lleva disparador

- **Contexto:** la historia pedía sumar `Voided`, `Confirmed` y `Reversed` como
  disparadores de re-evaluación (RF-18). Antes de implementarlos se verificó qué cambia
  cada uno en el veredicto.
- **Evidencia en el código:**
  - `AssertionPostingReader.byAccountUpToDate` devuelve `CONFIRMED` **y** `PENDING`, y
    excluye `VOIDED`.
  - `AssertionEvaluator.evaluate` suma la población incluida sin mirar el estado: su
    `partition` es puramente temporal (intradía vs cierre de día).
- **Conclusión por evento:**
  1. `TransactionVoided` → el posting **sale** de la población → el saldo cambia →
     disparador necesario.
  2. `TransactionConfirmed` → el posting ya contaba como `PENDING` y sigue contando por el
     mismo monto → el veredicto no puede cambiar → disparador innecesario.
  3. `TransactionReversed` → la reversa emite su propio `TransactionRecorded`, con postings
     y fecha en el payload, que el reactor procesa desde siempre → ya cubierto.
- **Elegida:** implementar únicamente `TransactionVoided`, y dejar dos tests que
  documentan por qué los otros dos no llevan disparador.
- **Descartadas por:** agregar los tres habría sido inofensivo (re-evaluar es idempotente)
  pero mete consultas a `proj_postings` y ejecuciones de `EvaluateAssertion` que nunca
  cambian nada, en el camino crítico de un flujo que ya es delicado.

**Riesgo asumido:** si algún día el evaluador pasa a distinguir confirmado de pendiente
—por ejemplo para conciliar solo contra saldo confirmado— `TransactionConfirmed` volvería a
importar. Los tests de AC-2 fallarían en ese momento, que es exactamente lo que se quiere:
son la alarma, no solo documentación.

---

## Decisión: el reactor lee `proj_postings`, no el payload ni el agregado

- **Contexto:** `TransactionVoided` lleva `{ reason }` y nada más. El reactor necesita las
  cuentas tocadas y la fecha contable para acotar qué aserciones re-evaluar.
- **Opciones evaluadas:**
  1. **Leer `proj_postings` por `transaction_id`.** Pros: sin cambio de esquema de eventos;
     el reactor sigue sin tocar el event store (RNF-10). Sin lag real: `transaction_list`
     —y con él `proj_postings`— es una proyección **síncrona**, escrita en la transacción
     del command (§8.1), y hu-0015 garantizó que el pump proyecta antes de alimentar al
     reactor. Contras: el reactor depende de una proyección de otro módulo.
  2. **Enriquecer el payload de los tres eventos** con `postings` y `date`. Pros: reactor
     autónomo. Contras: cambia el esquema de eventos → `schema_version` 2 + upcasting
     (RNF-6), y los eventos ya escritos quedan sin esos campos, así que el upcaster tendría
     que ir a buscarlos igual a una proyección. Resuelve el problema creando otro.
  3. **Cargar `LedgerTransaction` desde el event store.** Contras: pone al reactor a leer
     el write side, que es lo que la separación CQRS busca evitar.
- **Elegida:** opción 1.
- **Descartadas por:** 2 paga un cambio de esquema irreversible por una ventaja que no se
  materializa en los eventos históricos; 3 rompe la segregación.

---

## Decisión: se extiende `AssertionPostingReader` en vez de crear un puerto nuevo

- **Contexto:** el módulo ya tiene un puerto que lee `proj_postings` para la conciliación
  (`AssertionPostingReader`), con su adaptador `ReadModelAssertionPostingReader`.
- **Opciones evaluadas:**
  1. **Agregar un método al puerto existente** (`touchedByTransaction`). Pros: un único
     punto de acceso del módulo a `proj_postings` (DRY); reusa el adaptador y su mapeo.
  2. Crear un puerto aparte para la lectura del reactor. Pros: interfaces más chicas
     (ISP). Contras: dos puertos del mismo módulo leyendo la misma tabla, con dos
     adaptadores que hay que mantener en sincronía.
- **Elegida:** opción 1 — el puerto ya es «lo que la conciliación necesita leer de los
  postings»; esta consulta cae dentro de esa responsabilidad.
- **Descartadas por:** 2 duplica el acceso a `proj_postings` sin ganar aislamiento real.
