# Decisiones de Diseño — admin-back

> Log acumulativo de decisiones significativas de diseño, tomadas literalmente
> de la sección "Decisiones de Diseño" de cada historia que las generó (no
> solo las cross-cutting — también decisiones de un solo módulo). Lo mantiene
> `/sync` automáticamente al cerrar cada historia. Append-only: las entradas
> nunca se editan ni se borran; una decisión obsoleta se supersede con una
> entrada nueva que la referencia. Orden cronológico inverso (más reciente
> primero).

## Extracción de `libs/cqrs` — el event sourcing sale del ledger (2026-07-27)

**Supersede la decisión de EP-0.2 (2026-07-22) de mantener `apps/ledger`
autocontenido**, que fijaba duplicar en vez de compartir. Esa decisión se tomó
sobre `DatabaseModule` y la telemetría; el motor de event sourcing es otro caso.

- **`shared-kernel` no era homogéneo, y ese era el hallazgo.** Contenía el motor
  genérico (event store, buses, proyecciones) **y** dominio contable:
  `AccountName`, `AccountType`, `Payee`, `CurrencyCode`, `CurrencyCatalog`,
  `LedgerDate`, el catálogo semilla de monedas y el verificador de balances. Una
  carpeta llamada «kernel compartido» que sabía de partida doble.
- **Por eso se hizo en dos pasos.** Primero separar lo contable (commit propio,
  verificable), después mover lo que quedó. Mover el paquete entero habría
  arrastrado el negocio adentro de una librería de infraestructura.
- **Librería propia, no `libs/shared`.** `shared` ya es un cajón (config, auth,
  `Criteria`, filtros, telemetría) del que depende `finances`; meter el event
  sourcing ahí lo acopla a una app congelada que va a retirarse y la obliga a
  arrastrar lo que no usa.
- **El argumento no es el reuso.** No hay segundo consumidor: `finances` está
  congelado y la spec §9.3 dice que el módulo de producto se integra **por el
  API**, no compartiendo código. Lo que sí se gana es que el límite deje de
  depender de la disciplina: antes de la extracción `@Injectable` ya se había
  filtrado a once archivos del núcleo sin que nada fallara.
- **`Clock` e `IdGenerator` viajan con la librería**, junto con sus dobles
  deterministas y el helper de contract tests. §3.8 los lista como puertos del
  núcleo a la par de `EventStore`; dejarlos en el ledger habría hecho que la
  librería importara de la app.
- **Dos specs de integración se quedaron en el ledger** (`postgres-event-store`,
  `projection-rebuilder`): ejercitan la migración del esquema y los projectors
  contables, así que pertenecen a quien los define. Con eso la librería no
  importa del ledger **ni siquiera en sus tests**.
- **El guardián efectivo es un test, no Nx.** Se declaró la constraint de tags
  (`type:infra` → `type:infra`), pero el `allow: ['@ledger/**']` preexistente
  —necesario para que cada app alcance sus propios archivos por alias— hace
  bypass de las constraints, así que la regla no muerde. `domain-independence.spec.ts`
  recorre las fuentes y falla ante cualquier import de una app; se verificó
  introduciendo una violación a propósito. Queda anotado para no creer que la
  configuración de Nx protege algo que no protege.
- **Bug preexistente corregido de paso:** el contract test del `Clock` comparaba
  `clock.now()` contra `clock.now()` en una sola aserción, y el valor esperado se
  evalúa último — así que afirmaba lo contrario de lo que decía su nombre y
  fallaba justamente cuando el reloj avanzaba entre ambas lecturas.

---

## Instante de negocio en los eventos — aserciones intradía (2026-07-27)

Cierra la deuda que la auditoría de más abajo había dejado abierta. Habilitado por que no
hay datos en producción: cambia el esquema de eventos y el de proyecciones sin upcasting
(RNF-6 no se ejerce) y reescribiendo la migración `1790000000003` en vez de encadenar una.

- **La raíz no era la columna que faltaba, era el envelope.** `EnvelopeFactory` fijaba
  `occurredAt: recordedAt`, o sea el instante en que corrió el command. §3.4 declara los dos
  campos por separado, y si siempre coinciden el par no tiene sentido: toda transacción
  parecía haber ocurrido en el momento en que el ledger se enteró de ella.
- **El evento declara su propio instante** (`DomainEvent.occurredAt()`, null por defecto) y
  el envelope lo toma, cayendo al reloj cuando no hay ninguno. Se eligió esto antes que
  pasar el dato por el `AuthContext` o por parámetro de `build`: quién sabe cuándo ocurrió
  un hecho es el hecho mismo, y así cualquier evento futuro lo hereda sin tocar la factory.
- **`RecordTransaction` acepta `occurredAt` opcional** y `TransactionRecorded` lo porta en el
  payload. En el DTO es opcional a propósito: una notificación bancaria trae instante, un
  gasto cargado a mano no, y forzar uno inventado es peor que no tenerlo.
- **`occurredAt` va antes de `origin` en el constructor del command.** TypeScript obliga a
  pasar todos los parámetros hasta el último que se quiere fijar; con el orden inverso, el
  controller HTTP habría tenido que nombrar `origin` para llegar a `occurredAt`, destruyendo
  la garantía de INV-13 de que nada que venga de la API puede declararse `SYSTEM`.
- **Las proyecciones guardan el instante del payload, nunca el del envelope.** El del
  envelope siempre tiene valor, así que proyectarlo borraría la diferencia entre «ocurrió a
  las 14:03» y «instante desconocido» — exactamente lo que el evaluador necesita distinguir
  para responder `INDETERMINATE` en vez de un veredicto inventado. Por eso
  `proj_transactions.occurred_at` pasa a ser nullable y significa el instante declarado.
- **`proj_postings` gana `occurred_at` denormalizado** desde su transacción, para que el
  ordenamiento intradía no necesite join. Una enmienda no lo toca: revisa qué se asentó, no
  cuándo ocurrió.
- **El evaluador no cambió una línea.** Su lógica de partición y de `INDETERMINATE` ya era
  correcta (§2.4); solo estaba recibiendo `null` siempre porque el adaptador lo fijaba así.
  La pregunta abierta #6 de la spec sigue abierta en lo suyo — qué hacer cuando conviven
  transacciones con y sin instante frente a una aserción intradía —, pero ahora es una
  decisión que se puede tomar con datos, no un camino muerto: la regla conservadora actual
  ya solo se dispara sobre los postings que de verdad no se pueden ordenar.

---

## Auditoría del núcleo contra la spec v0.8 (2026-07-27)

Revisión completa del código de `apps/ledger` contra `ledger-spec.md` §3–§7 y los
invariantes §5.1. Los hallazgos se corrigieron en la misma pasada; lo que sigue son las
decisiones que esas correcciones obligaron a tomar.

### Roturas de cableado encontradas

- **`POST /v1/currencies` nunca funcionó.** El controller despachaba `RegisterCurrency` por
  el `CommandBus`, pero la factory nunca registraba ese handler: toda llamada terminaba en
  `UnregisteredCommandException`. En el mismo lugar faltaba `CurrenciesProjector` en el
  dispatcher síncrono, así que `proj_currencies` solo se materializaba corriendo la CLI de
  rebuild. El catálogo administrable (RF-21, EP-4.2) estaba muerto de punta a punta y
  ninguna suite lo cubría.
- **Nuevo test de wiring como red permanente** (`app.wiring.spec.ts`): compara los handlers
  registrados en el bus contra el catálogo de §3.5. El registro ocurre en dos lugares —la
  factory del core y el `onModuleInit` de cada módulo—, así que un command puede compilar,
  tener endpoint y no tener handler; eso solo se veía al llegar una petición real. Obligó a
  exponer `PolicyCommandBus.registeredTypes()`.

### Idempotencia: los commands que evitaban el bus

`/transfers/merge` y los tres `POST` de `/balance-assertions` invocaban sus handlers
directamente como providers de Nest, salteándose la cadena de políticas completa. §4.1 y
RF-11 exigen idempotencia por `external_ref` en **todos** los commands, y el contrato del
puerto `EventStore` (§3.8) pide replay del resultado original, no un 409.

- **Se enrutan los cuatro por el `PolicyCommandBus`**, registrándolos desde el
  `onModuleInit` de `TransactionsModule` y `ReconciliationModule` (sus dependencias son
  adaptadores que la factory del core no conoce).
- **Los DTOs de salida propios desaparecen en favor de `CommandResult`.**
  `MergeTransfersOutputDto`, `AssertBalanceOutputDto`, `RevokeAssertionOutputDto` y
  `ResolveDiscrepancyOutputDto` devolvían ids que el `CommandResult` genérico ya expone como
  `aggregateId`. El criterio para elegir cuál id: **el que lleva el `external_ref` es el que
  la política de idempotencia reconstruye del ancla**, así que es el que el resultado debe
  nombrar — la transferencia en el merge, la transacción de ajuste en el resolve, la
  declaración en el assert. Los ids que el cliente mandó en su propio request no se devuelven.

### INV-13: origen de posting

La segunda mitad de INV-13 («las cuentas técnicas solo reciben postings de transacciones de
origen sistema») no existía: cualquier cliente autenticado podía postear contra
`Equity:Adjustments`. La metadata `{ source: 'system' }` que usaba `ResolveDiscrepancy` era
convención pura, falsificable desde el body.

- **`PostingOrigin` (`CLIENT` | `SYSTEM`) viaja en el command, no en metadata ni derivado de
  `client_id`** — §2.10 fija que `client_id` es metadata opaca y jamás autorización. El
  default es `CLIENT`: olvidarse de pasarlo solo puede fallar cerrado.
- **`RecordOpeningBalance` es un command dedicado** (`POST /v1/accounts/{id}/opening-balance`)
  y no una variante del DTO de transacciones. Resuelve la contrapartida y el origen en el
  servidor, así que ningún payload HTTP puede alcanzar una cuenta técnica. Es lo que
  desactiva la tensión entre INV-13 y RF-27: el saldo inicial tiene su propia puerta en vez
  de obligar a dejar `Equity:OpeningBalances` abierta al command genérico.

### Otras correcciones

- **Colisión de nombre al renombrar (§2.1.1).** `RenameAccount` no validaba nada. El chequeo
  se extrajo a `AccountNameRegistry`, compartido con `OpenAccount`, y **cubre el subárbol
  completo**: el renombre re-prefija a los descendientes, así que con solo validar el nombre
  nuevo un descendiente podía aterrizar sobre una cuenta existente. El índice único de
  `proj_accounts (user_id, name)` habría hecho explotar el projector *después* de que el
  evento ya estaba en el stream — proyección rota que ningún rebuild arregla.
- **`pending_review` se construye** (§3.6). `GET /transactions?status=PENDING` responde la
  misma pregunta, pero la bandeja solo contiene lo que está esperando decisión mientras
  `proj_transactions` crece para siempre. Se sirve por `GET /v1/transactions/pending-review`,
  declarado antes de `:id` porque Nest resuelve rutas por orden de declaración.
- **RF-4: `COMPOUND` en vez de adivinar.** `derive([])` devolvía `TRANSFER` por `[].every()`
  vacuamente cierto, y `EXPENSES` + `INCOME` juntos devolvían `EXPENSE` por el orden de los
  `if`. Ambos casos pasan a `COMPOUND` (§9.4.4: lo no clasificable nunca se fuerza a un tipo
  concreto). El projector aplica el mismo criterio cuando alguna cuenta todavía no está en
  `proj_accounts`, en vez de derivar de evidencia parcial.
- **`TransfersMerged` existe** (§3.4), sobre el stream de la transferencia resultante: es lo
  que trajo a ese agregado a la existencia, y cada pierna ya cuenta su verdad con su
  `TransactionVoided`. No muta estado del agregado — es procedencia, no ciclo de vida.
- **RF-16 conserva las `external_ref` de ambas piernas**, leídas del stream y no de
  `proj_transactions` (§6.3 fija que la fusión valida contra los agregados, nunca contra una
  proyección). `merged_from` con los ids se conserva; `merged_external_refs` se suma.
- **INV-7 en `ReverseConfirmedTransaction` e `InitializeLedger`.** El fix de HU-0023 cubrió
  solo `merge` y `resolve`; estos dos seguían escribiendo dos y tres streams sin
  `withTransaction`. El dispatch a proyecciones queda fuera del scope en ambos: los read
  models son reconstruibles y un fallo de projector no debe revertir hechos contables.
- **RF-14: el catálogo era mentira.** `LEDGER_ERROR_CODE` se declaraba «fuente única de
  verdad» con 17 códigos mientras el dominio emitía 41 — el filtro compartido publica
  cualquier `code`, así que 24 códigos llegaban a los clientes sin estar documentados. Se
  completó y un test recorre las fuentes para que no vuelva a desincronizarse.
- **RNF-11: `@Injectable()` fuera del núcleo.** Se había filtrado a 11 archivos de
  `domain/` y `application/`. Los módulos ahora declaran esos providers con `useFactory`
  explícito. Un test (`hexagonal-isolation.spec.ts`) recorre el árbol y falla ante cualquier
  import de `@nestjs/*`, `typeorm`, `pg` o `express` en el núcleo: era un decorador inocuo,
  y así es como se erosiona un límite — nada falla, nadie lo nota, y la infraestructura real
  entra después por el mismo camino.

### Deuda que se deja abierta a conciencia

- **`ConsistencyVerifier` solo verifica balances.** RNF-5 pide verificación entre
  proyecciones y stream; el rebuild cubre las 8 proyecciones, la verificación solo
  `proj_balances`. No se amplió acá: es trabajo de tamaño propio y el rebuild ya resuelve el
  caso real de corrupción.
- ~~**Aserciones intradía inertes.**~~ **Resuelto el mismo día** — ver la entrada de abajo.

---

## HU-0023 — Atomicidad cross-stream de commands multi-agregado (2026-07-27)

- **`withTransaction(fn)` sobre `appendMany(batches)`** (elegido por el usuario): conserva
  el reuso de commands. Los dos handlers despachan `RecordTransaction` y
  `VoidPendingTransaction` por el `CommandBus` (3 dispatches en `merge`, 1 en `resolve`);
  con `appendMany` habrían tenido que dejar de usar el bus y orquestar los agregados a mano
  para juntar los envelopes, duplicando lógica de `RecordTransactionHandler`. Con
  `withTransaction` solo se envuelve la operación.
- **`AsyncLocalStorage` para propagar el `EntityManager`.** El scope transaccional tiene que
  llegar desde el handler hasta el `append`, pero pasarlo como parámetro habría obligado al
  dominio a cargar un objeto de base de datos (RNF-11, Artículo 1). El adaptador Postgres lo
  guarda en AsyncLocalStorage y `append` se une al scope abierto si lo hay; fuera de uno,
  abre su propia transacción exactamente como antes.
- **El in-memory simula rollback con un snapshot.** Copia superficial de la lista de eventos
  al abrir el scope y restauración al fallar — alcanza porque `StoredEvent` nunca se muta en
  su lugar, solo se agrega. Sin esto los contract tests no podrían correr idénticos en ambos
  adaptadores (RNF-11).
- **Anidar une, no apila.** Una llamada interna a `withTransaction` se suma al scope externo
  en vez de abrir una segunda transacción; el contract test lo fija, porque lo contrario
  permitiría que un tramo confirmara por su cuenta mientras el externo revierte.

---

## HU-0019 — Catálogo de monedas administrable (2026-07-26)

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

---

## HU-0018 — Endpoints de configuración del ledger (2026-07-26)

- **`PUT /v1/ledger/settings` que reemplaza la configuración completa** (elegido por el
  usuario). El riesgo que se le señaló —dos commands en una petición, con estado intermedio
  si el segundo falla— **no se materializa**: `LedgerSettings` es un único agregado cuya
  raíz es el `user_id`, y `EventSourcedRepository.save()` agrupa todos los `pullChanges()`
  en **un solo `append`**. Un command que invoca ambos cambios emite los dos eventos
  atómicamente sobre el mismo stream (§3.5). Verificado en
  `event-sourced.repository.ts:43-56`.
- **Un command, no dos:** `ReplaceLedgerSettingsCommand`. Despachar dos commands desde el
  controller sí habría roto la atomicidad; un command que orquesta dos métodos del mismo
  agregado, no.
- **Los eventos de cambio se registran en el `EventRegistry`.** No lo pide ningún AC, pero
  sin eso `LedgerSettingsRepository.load()` no puede rehidratar un agregado que ya tenga un
  cambio previo — el segundo PUT fallaría — y un rebuild de `ledger_settings` ignoraría los
  cambios. Es condición necesaria de AC-1.
- **El projector aplica leer-mezclar-escribir**, siguiendo lo que hu-0015 estableció: el
  contrato de `upsert` reemplaza la fila entera, así que escribir solo la columna cambiada
  borraría los ids de las cuentas técnicas.
- **`LEDGER_NOT_INITIALIZED` se reutiliza**, no se inventa: ya existe como código estable y
  ya tiene una excepción en `reconciliation`. Se agrega la equivalente en el módulo de
  settings.

---

## HU-0017 — Documentacion viva del modulo reconciliation (2026-07-26)

- **Pipeline colapsado para una historia docs-only:** no se corrio `/design` ni `/plan`. En
  una historia sin codigo, el "diseno" y la "implementacion" son el mismo artefacto —
  generar un delta de documentacion para reconciliarlo despues contra la documentacion
  habria sido ceremonia sin contenido. Se hizo el scan (que si aporto: inventariar los
  endpoints y DTOs reales) y se produjeron los docs directamente.
- **Mas de la mitad de los AC ya estaban cumplidos al empezar:** hu-0015 y hu-0016 dejaron
  el modelo LikeC4, el README y 4 de los 9 flujos como efecto colateral de documentar su
  propio trabajo. La historia se redujo a los 5 flujos REST, el `api.yaml` y la limpieza de
  los docs de `transactions`. Es senal de que documentar dentro de cada historia funciona:
  la historia de "documentar el modulo" llega casi vacia.
- **`$ref` a `shared/api.yaml` verificados uno por uno:** dos de los cuatro no existian
  (`Unauthorized` y `DomainError`); el schema real es `ErrorResponseBody` y `shared` no
  expone `responses`. Se definieron localmente en el modulo.
- **AC-5 cerro deuda propia:** los docs de `transactions` seguian describiendo la deteccion
  de transferencias removida en `934c3fa` — README, 3 componentes del `.c4`, una dynamic
  view y el flujo `detect-transfer.md`. Lo dejo esta misma sesion al recortar el alcance;
  se limpio aca.

---

## HU-0016 — Re-evaluación de aserciones ante anulaciones (2026-07-26)

- **Solo `TransactionVoided` lleva disparador:** verificado contra `AssertionPostingReader`
  (devuelve `CONFIRMED`+`PENDING`, excluye `VOIDED`) y `AssertionEvaluator` (suma sin
  discriminar por estado). `Confirmed` no cambia el monto evaluado y `Reversed` ya se cubre
  por el `TransactionRecorded` de la reversa. AC-2 se reescribió con esa evidencia y la
  historia deja dos tests que la documentan.
- **El reactor lee `proj_postings` por `transaction_id`:** sin cambio de esquema de eventos
  y sin lag, porque esa proyección es síncrona (§8.1) y el pump proyecta antes de reaccionar
  (hu-0015). Se descartó enriquecer el payload de los eventos, que habría exigido
  `schema_version` 2 + upcasting (RNF-6) sin resolver los eventos ya escritos.
- **Se extiende `AssertionPostingReader`** con `touchedByTransaction` en vez de crear un
  puerto nuevo: mantiene un único punto de acceso del módulo a `proj_postings` (DRY).
- **La atomicidad cross-stream sale a hu-0023:** es integridad transaccional, no
  re-evaluación, y alcanza también a `MergePendingTransfers`.

> Alternativas evaluadas y descartadas: [`docs/research.md`](./docs/research.md).

---

## HU-0015 — Persistencia Postgres de las proyecciones de conciliación (2026-07-26)

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

---

## Alcance del ledger acotado a su núcleo contable (2026-07-25)

Supersede el alcance de §4.1 de `ledger-spec.md` y las épicas EP-4/EP-5 del roadmap.

**Decisión.** `apps/ledger` es un ledger de partida doble y nada más: cuentas,
transacciones, conciliación, fusión de transferencias, settings y catálogo de monedas.
Todo lo que no genera ni valida un asiento sale del alcance.

**Motivación.** La propia spec ya lo señalaba y se resolvió al revés:

- Principio de diseño **#7**: *"agrupaciones, vistas consolidadas y conversiones de moneda
  para reportes viven en proyecciones y capa de producto, **fuera del núcleo contable**"*.
  EP-4.5 (`net_worth`) y EP-4.6 (`/reports/*`) lo contradicen frontalmente.
- §4.3 admite *"un solo bounded context (Ledger) **con producto embebido** — evita
  sobre-ingeniería en v1; **extraíble por eventos si crece**"*, con reversibilidad *Media*.
  Se ejerce esa salida ahora, antes de construirlo, en vez de después.

**Dentro del alcance:** EP-1, EP-2, EP-3.1–3.6 (conciliación completa: es el principio #6 y
RF-17..RF-20, contabilidad pura), `MergePendingTransfers` (RF-16), `LedgerSettings` (el
`timezone` es el parámetro del que RNF-7 deriva el cierre de día de las aserciones, y EP-3 ya
lo consume), y el catálogo de monedas con `minor_units` (lo exige `Money` por INV-8/RNF-2).

**Fuera del alcance:** `Budget` (RF-24) y `Goal` (RF-25) — no emiten postings ni alteran
saldos; valoración `net_worth` (RF-23) y reportes consolidados; el feed de tasas de cambio
(RF-22), que es dato de referencia externo y cuyo único consumidor era la valoración; y la
proyección `transfer_candidates` (RF-15), que es una sugerencia heurística con ventana
calibrable (`TRANSFER_WINDOW_DAYS`) — la spec §8.2 la tenía como pregunta abierta #4 sin
resolver. Un ledger valida un merge que le nombran; no adivina cuál proponer.

**EP-5 se disuelve como épica.** No existe en la spec (§11 define 4 fases) y mezclaba tres
cosas sin relación: retirar módulos de `finances` (trabajo sobre otra app), backups y runbook
(operabilidad de plataforma), y OTel (RNF-12, transversal). Se replanifican como tareas de
infraestructura, no como fase de construcción del ledger.

**Consecuencia inmediata.** `transfer_candidates`, su store, su proyector, el endpoint
`GET /transfers/candidates` y el `TransferDetector` con ventana temporal se removieron. La
regla de pareo sobrevive como `TransferPairRule` (montos opuestos que netean a cero, misma
moneda, cuentas reales distintas), ahora sin ventana ni tolerancia, usada por
`MergePendingTransfersHandler` para validar el par que el cliente nombra.

De paso se corrigió una violación de RNF-10 que venía con ese diseño: el handler decidía un
invariante leyendo una proyección (`TransferCandidateStore`). Ahora carga ambos agregados
desde el event store vía `LedgerTransactionRepository` y valida contra ellos.

---

## Deuda conocida — `nx build ledger` falla con 115 errores (2026-07-25)

Registrado al cerrar HU-0012/0013/0014. **La app no compila**, así que tampoco arranca.

- Los 115 errores están confinados a `settings`, `reference`, `reporting` y `product`:
  andamiajes de EP-3/EP-4 escritos contra un layout de imports viejo (59 de 115 son `TS2307`,
  módulo no encontrado — p.ej. `shared-kernel/application/command/command-bus`, que hoy es
  `command-bus/command-bus`). Cuatro suites de test del módulo `settings` ni siquiera
  compilan por la misma causa.
- **Cero errores** en `accounts`, `transactions`, `shared`, `shared-kernel` y `ledger` — el
  código de las tres HU de EP-2 está limpio y sus 387 tests pasan.
- `app.module.ts` importa `SettingsModule`, así que el fallo alcanza al arranque. Los otros
  tres módulos rotos no están cableados (hay un comentario en `app.module.ts` que lo declara
  pendiente de migración), pero TypeScript los compila igual por estar en el proyecto.
- **Decisión:** no se reparan en estas HU — pertenecen a épicas no iniciadas y las tres
  historias los listan explícitamente como *Fuera de Alcance*. Se registran como deuda. Las
  opciones evaluadas fueron repararlos (trabajo grande, fuera de alcance) o desconectarlos de
  `app.module.ts` para recuperar el arranque (cambio chico); se difiere la elección a la
  historia que retome EP-3/EP-4.

---

## HU-0014 — Endpoints de transacciones — ciclo de vida completo (2026-07-25)

Historia de sincronización documental: el código manda sobre la especificación, **salvo en
tres defectos** que no eran divergencias de spec sino fallas, y que sí se corrigieron.

### Correcciones de código aplicadas

- **Suite e2e desbloqueada:** `accounts-api.e2e.spec.ts` y `transactions-api.e2e.spec.ts`
  fallaban 13 tests porque `LedgerCoreModule` declara `PostgresEventStore` y
  `PostgresReadModelStore` como providers y Nest los instanciaba aunque el test
  sobrescribiera los buses, exigiendo un `DataSource` inexistente. Se agregó el override de
  ambos puertos **en los tests**; producción no se tocó. 13 rojos → 0.
- **`/amend` con campos opcionales:** el DTO declaraba `postings?` y `date?` y el controller
  rellenaba con `[]` y `''`, produciendo un `422` desconcertante (`"" is not a YYYY-MM-DD
  date`) al omitirlos. Como `LedgerTransaction.amend` hace **reemplazo total**, una enmienda
  parcial no tiene representación en el dominio: se alineó el DTO haciendo ambos campos
  requeridos, así un campo faltante da un `400` de validación claro. El test que congelaba
  el bug (`controller.spec.ts`, que afirmaba `postings: []`) dejó de compilar y se reescribió
  para ejercitar un amend real.
- **Filtro `account` aplicado después de paginar:** `GET /transactions?account=X&limit=N`
  extraía una página de **todas** las cuentas y recién después la filtraba, ocultando
  coincidencias más allá de la primera página. Se reordenó: los `transaction_id` de la
  cuenta se resuelven primero y entran al criteria como `oneOf` antes de paginar. Trampa
  encontrada al hacerlo: `Criteria.oneOf` con array vacío devuelve `this` **sin filtro**, así
  que una cuenta sin postings habría devuelto todas las transacciones — se cortocircuita
  explícitamente. Además se aplicó el `limit` por defecto de 50 que el DTO anunciaba en
  Swagger pero nunca se usaba, dejando las lecturas acotadas. Se agregó
  `list-transactions.handler.spec.ts` con 4 casos.

### Divergencias documentadas (el código se mantiene)

- **AC-3 — el listado devuelve un array crudo, no una página:** no hay envoltorio con
  `total`/`limit`/`offset`; el `TransactionListDto` decora Swagger pero no se construye. Sin
  `total`, el cliente detecta el fin cuando recibe menos filas que el `limit`. Se corrige el
  AC y el `api.yaml`.
- **AC-3 — `GET /transactions/{id}` devuelve la fila cruda sin postings, o `null`:** las
  líneas viven en `proj_postings` y la ruta no las cruza; una transacción inexistente da
  `200 null`, no `404`. Mismo patrón que `GET /accounts/{id}` en HU-0013. Se elimina el `404`
  del `api.yaml`.
- **AC-3 — el rango de fechas es `from`/`to`, no `period`:** se corrige el AC.
- **AC-4 — un solo posting da `400`, no `422`:** el `ArrayMinSize(2)` del DTO rechaza en el
  `ValidationPipe` antes de llegar al agregado, dejando `INSUFFICIENT_POSTINGS` (INV-2)
  inalcanzable por HTTP. La autoridad conceptual del invariante sigue siendo el dominio, pero
  **por HTTP gana la malla de forma**; se documenta el `400` como contrato observable en vez
  de mover la validación.
- **AC-2 — `/confirm` ignora el body y `/reverse` ignora el `reason`:** ambos controllers
  declaran `_dto` y despachan solo con el `id`. Se decide **conservar los campos** en el
  contrato (evita un breaking change si se implementan) pero documentarlos explícitamente
  como sin efecto. Confirmar con postings distintos no está soportado: la vía es `amend` y
  después `confirm`.
- **AC-2 — `/annotate` tiene semántica de reemplazo total, no de parche:** los campos
  omitidos se envían vacíos (`description ?? ''`, `tags ?? []`) y **borran** el valor previo.
  Se mantiene y se documenta de forma prominente: el opcional del DTO expresa "podés no
  mandarlo", no "se preserva". Para conservar un campo hay que reenviarlo.
- **AC-6 — `ACCOUNT_CLOSED` es 422, no 409:** manda la decisión de HU-0011. Las transiciones
  de estado inválidas emiten `INVALID_TRANSACTION_STATE` (409), código que no figura en el
  const `LEDGER_ERROR_CODE` — ver la entrada de HU-0013.

---

## HU-0013 — Endpoints de cuentas — `/ledger/initialize`, `/accounts` (2026-07-25)

Historia de sincronización documental: el código manda sobre la especificación.

- **AC-10 (nuevo) — el read-side devuelve filas de proyección, no DTOs:** se mantiene lo
  implementado. Las cuatro lecturas (`GET /accounts`, `/accounts/{id}`,
  `/accounts/{id}/balance`, `/ledger/settings`) responden con la fila cruda en `snake_case`
  (`account_id`, `currency_code`, `confirmed_amount`, `presentation_currency`). Los
  `AccountDto`/`AccountTreeDto`/`AccountBalanceDto`/`LedgerSettingsDto` existen y decoran
  Swagger, pero **no se construyen**: `queryBus.ask<AccountDto>(...)` es un genérico sin
  verificación. Se corrigen los schemas del `api.yaml` para describir la fila real y se
  agrega una nota de contrato al documento. Unificar (mapper explícito o proyecciones en
  `camelCase`) es trabajo de otra HU.
- **AC-3 — `type` y `parentId` no se transportan:** se mantiene la derivación desde el
  nombre jerárquico. `Account.open` obtiene el tipo de `name.rootType` y el padre de
  `name.parentName()`; el command solo lleva `(name, currencies, openedOn, isBankMirror)`.
  Los dos campos siguen en el DTO como malla de forma, pero **el nombre es la autoridad** y
  un `type` contradictorio se ignora en silencio. Se documenta en el `api.yaml` y en
  `open-account.md` en vez de extender el command.
- **AC-4 — `?view=tree|flat` se acepta y se ignora:** se decide **no** retirar el parámetro
  del contrato (evita un breaking change cuando se implemente el shaping) pero se documenta
  explícitamente como sin efecto, con el `TODO(read-shape)` de `account-tree-view.ts` como
  referencia. La respuesta es siempre plana; el cliente puede reconstruir el árbol desde el
  nombre jerárquico.
- **AC-4 — `GET /accounts/{id}` inexistente devuelve `200 null`, no `404`:** se mantiene. El
  handler hace `row ?? null` y ninguna capa lo traduce. Se elimina el `404` del `api.yaml`,
  que prometía un comportamiento inexistente. Nota: una cuenta de otro usuario es
  indistinguible de una inexistente, lo cual es deseable (no filtra existencia entre
  usuarios).
- **AC-5 — `?currency` se acepta y se ignora:** mismo criterio que `view`. Documentado, no
  retirado.
- **AC-7 — `ACCOUNT_CLOSED` y `CURRENCY_NOT_ALLOWED` son 422, no 409:** manda la decisión de
  HU-0011 y el catálogo RF-14. Además, **ninguno de los dos es alcanzable desde los
  endpoints de cuentas**: se emiten al postear contra una cuenta cerrada o con moneda no
  permitida, que es ruta de `/transactions` (HU-0014). Se corrige el AC.
- **`LEDGER_ERROR_CODE` no es exhaustivo:** hallazgo transversal. El const declara 17
  códigos pero el API emite **39** — cada excepción declara su `code` por su cuenta y el
  `ExceptionFilter` lo expone verbatim, así que los 22 faltantes son igual de públicos y
  estables. Se documentan los 39 en el enum `LedgerErrorCode` del `api.yaml` compartido y en
  la tabla de `map-domain-error.md`, agrupados por origen. Sumarlos al const es aditivo y
  queda como trabajo de seguimiento. (Corrección sobre una lectura intermedia: no hay
  códigos catalogados que el API no emita.)

---

## HU-0012 — Read-your-writes + idempotencia por `external_ref` (2026-07-25)

Historia de sincronización documental: el código ya existía (construido como efecto
colateral de `hu-0005` y `hu-0009`) y **manda sobre la especificación**. Los AC se
corrigieron para describir el runtime, siguiendo el precedente de HU-0011.

- **AC-3 — `external_ref` es clave de reintento, no detector de colisiones:** se mantiene
  el comportamiento implementado. `IdempotencyPolicy` recibe el command como `_command` y
  nunca lo compara: cualquier reenvío del mismo `(user_id, external_ref)` replaya el
  `CommandResult` original con `200`. La `DuplicateExternalRefException` del índice único
  también se atrapa y se replaya. **Consecuencia:** `DUPLICATE_EXTERNAL_REF` queda
  inalcanzable vía HTTP; se documenta como tal en `map-domain-error.md` y en el enum
  `LedgerErrorCode` del `api.yaml`, y el código permanece porque sigue siendo contrato del
  puerto `EventStore`. Se corrige el AC de la HU en vez del código.
- **AC-5 — Read-your-writes inline pero no atómico:** se mantiene lo implementado. Los 10
  handlers hacen `repository.save(...)` y luego `dispatcher.dispatch(result.events)` como
  operaciones **secuenciales sin transacción compartida**; no existe `UnitOfWork` ni
  `queryRunner` fuera de las migraciones. El AC afirmaba "misma transacción del command
  (ACID conjunto)", lo cual es falso. Se corrige el AC. Hacerlo atómico exige un
  `UnitOfWork` compartido entre `EventStore` y `ReadModelStore` y queda para EP-3.
- **AC-6 — El gancho `min_position` no se construye:** cero ocurrencias de `min_position` /
  `X-Ledger-Min-Position` en `apps/ledger/src`. Se decide **no** agregarlo como no-op: un
  parámetro aceptado-e-ignorado es una promesa de contrato que el servidor no cumple. Se
  difiere entero a EP-3, junto con la espera activa por checkpoint. La mitad publicada del
  mecanismo (`streamPosition` en toda escritura) sí queda lista.
- **AC-4 — `CommandResultInterceptor` es opt-in, no global:** se mantiene el
  `@UseInterceptors` por controller en vez de migrar a `APP_INTERCEPTOR`. Lo declaran
  `AccountsController`, `LedgerController` y `TransactionsController`; los controllers de
  EP-3 ya montados (`BalanceAssertionController`, `TransferController`) no, así que sus
  escrituras no exponen `X-Ledger-Stream-Position`. Alinearlos pertenece a EP-3. Mover el
  interceptor a `APP_INTERCEPTOR` lo resolvería de raíz y queda registrado como opción.
- **Ubicación de los artefactos:** viven en `shared/infrastructure/adapters/http/`, no en
  `shared-kernel/`, según la decisión de RNF-11 de HU-0009. La HU no crea artefactos: el
  `@ExternalRef()` y el `CommandResultInterceptor` ya existían.

---

## HU-0011 — Códigos de error de dominio estables (RF-14) (2026-07-25)

- **Status de `ACCOUNT_CLOSED`:** **422** (se mantiene el código implementado) —
  posting a cuenta cerrada (INV-3) es una violación semántica del payload que el
  cliente corrige eligiendo otra cuenta, misma categoría que `CURRENCY_NOT_ALLOWED`;
  el mapping-spec ya lo congeló así con rationale explícito. Se corrige AC-2 de la
  HU vía `/refine`.
- **Status de `LEDGER_NOT_INITIALIZED`:** **422** (se mantiene el código
  implementado) — se agrega la fila faltante al mapping-spec y se corrige AC-2 de
  la HU vía `/refine`.
- **Ubicación de `LEDGER_ERROR_CODE`:** se mantiene en
  `apps/ledger/src/shared/domain/errors/ledger-error-code.ts` — los códigos son
  contrato de dominio (Art. 1: el dominio no importa desde `infrastructure/`) y no
  existe ningún adapter `http/` bajo shared-kernel. Se corrige la HU vía `/refine`.
- **Alcance de la tabla RF-14:** se suman **settings y Money** — las excepciones de
  settings (`InvalidCurrencyCodeException`, `InvalidTimeZoneException`) se
  reclasifican dentro de `DomainException` y las de Money reciben `code` propio;
  los 6 códigos entran a `LEDGER_ERROR_CODE` y al mapping-spec (aditivo).

---

## HU-0009 — Andamiaje del adaptador HTTP — OpenAPI/versionado + patrón controller→bus (2026-07-24)

- **AC-2 — Ruta de Swagger:** `/api/docs`, no `/api/v1/docs`. `SwaggerModule.setup` respeta `setGlobalPrefix('api')` pero no `enableVersioning` — Swagger no registra rutas por versión.
- **AC-5 — Campos de CommandAcceptedDto:** `{ id, streamPosition }` (2 campos), no `{ id, sequence, streamPosition }`. `CommandResult` expone `aggregateId`, `streamPosition` (bigint), `idempotentReplay` — no existe `sequence`.
- **RNF-11 — Ubicación del código HTTP:** `shared/infrastructure/adapters/http/`, no `shared-kernel/infrastructure/adapters/http/`. `shared-kernel/` aloja el núcleo hexagonal (domain + application ports + infra de event-store/proyecciones); `shared/` aloja código de dominio compartido y los adaptadores HTTP.
- **Estado general:** La HU documenta infraestructura ya construida. Los ACs son reformulados para reflejar el código existente. El wiring test (`app.wiring.spec.ts`) y el Swagger builder (`ledger-swagger.builder.ts`) ya pasan en verde.

## HU-0008 — Tooling de rebuild/replay + verificación de consistencia (2026-07-24)

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

---

## HU-0007 — Adaptadores Postgres de EventStore y ReadModelStore (2026-07-24)

Sin incógnitas — todos los contratos (`EventStore`, `ReadModelStore`,
`describeEventStoreContract`, `describeReadModelStoreContract`) ya están
definidos por HU anteriores (`hu-0002`, `hu-0004`). Esta HU corrige y verifica
las implementaciones Postgres existentes contra esos contratos.

---

## HU-0006 — Proyectores transaction_list/account_balances + query bus (2026-07-24)

No hubo incógnitas que resolver — el código ya existe. El design documenta la
arquitectura tal como está implementada, verificando contra los AC de la HU.

---

## HU-0005 — Command bus + políticas transversales + handlers núcleo (2026-07-23)

Sin unknowns pendientes — todos los artefactos descritos en `hu.md` ya están implementados en el código base. Este documento registra retroactivamente el diseño para trazabilidad. El command bus usa Chain of Responsibility con orden fijo de 3 políticas (`AuthenticatedContextPolicy` → `IdempotencyPolicy` → `OptimisticConcurrencyPolicy`) cableado en `createLedgerApplication()`. Los 8 handlers núcleo delegan en los agregados `Account`, `LedgerTransaction` y `LedgerSettings` sin lógica de negocio adicional más allá de la orquestación y validación cruzada contra `account_tree`.

---

## HU-0002 — Puerto `EventStore` + adaptador in-memory + contract tests (2026-07-23)

- **AC-11 — Ubicación del guard de lote vacío:** guard en ambos lados — `EventSourcedRepository.save()` retorna early si `pullChanges()` está vacío, **y** `InMemoryEventStore.append()` maneja `events: []` como no-op. Defensa en profundidad: el repositorio nunca llama al store sin cambios, y el store tolera lotes vacíos independientemente del caller.

---
