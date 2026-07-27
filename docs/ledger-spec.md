# Especificación Técnica — Ledger Service de Finanzas Personales (Partida Doble)

**Versión:** 0.8
**Fecha:** 2026-07-25
**Estado:** Propuesta

> **Cambio de alcance en 0.8 — el servicio se acota a su núcleo contable.** La capa de
> producto (presupuestos, metas, valoración, reportes consolidados), el feed de tasas de
> cambio y la detección heurística de transferencias salen del alcance de este servicio y
> pasan a un módulo o servicio de producto que consuma este API. La versión 0.7 los incluía
> por conveniencia de v1, contradiciendo su propio principio de diseño #7 y ejerciendo la
> concesión que §4.3 ya declaraba «extraíble por eventos si crece».
>
> Los conceptos recortados **no se borran de este documento**: quedan marcados como fuera
> de alcance y conservan su numeración de RF, para que el diseño siga disponible cuando ese
> módulo de producto se construya y para no romper las referencias del código.
> Fundamento completo en [`decisions.md`](./decisions.md), entrada del 2026-07-25.

---

## 1. Propósito y visión

Servicio de ledger de partida doble para finanzas personales, inspirado en los conceptos de Beancount. Constituye el núcleo contable del ecosistema: mantiene cuentas, transacciones y conciliación, y expone un API para que clientes externos (frontend, sistema de análisis de correos, u otros automatizadores) registren y consulten información financiera. Lo que no genera ni valida un asiento —presupuestos, metas, valoración, reportes consolidados— vive fuera de este servicio, sobre su API (§4.2).

El sistema **no conoce** correos electrónicos, bancos ni mecanismos de captura: recibe transacciones ya estructuradas a través de su API. Tampoco gestiona la identidad de los clientes que lo consumen: la autenticación y autorización residen en un servicio externo, y el ledger recibe en cada operación un `client_id` ya validado, que registra como metadata de procedencia. La calidad del núcleo se define por la rigurosidad de sus invariantes contables, no por sus integraciones.

A nivel técnico, el sistema se construye bajo **Domain-Driven Design (DDD)** con **event sourcing**, **CQRS** (Command Query Responsibility Segregation) y **arquitectura hexagonal**: el estado del ledger es la consecuencia de una secuencia inmutable de eventos de dominio, las escrituras y las lecturas transitan por caminos completamente separados (commands hacia agregados que emiten eventos; queries hacia proyecciones derivadas de esos eventos), los eventos son el único puente entre ambos lados (§3.2), y el núcleo de dominio y aplicación permanece aislado de toda tecnología concreta tras puertos con adaptadores intercambiables (§3.7).

### 1.1 Principios de diseño

1. **Partida doble como fundamento**: todo hecho económico se registra como una transacción cuyos asientos suman cero por moneda.
2. **El event stream es la única fuente de verdad**: saldos, listados y reportes son proyecciones reconstruibles desde los eventos. Ningún estado derivado se edita directamente.
3. **Separación estricta de escritura y lectura (CQRS)**: los commands nunca retornan datos de consulta ni leen proyecciones para decidir invariantes; las queries nunca tocan el event store ni ejecutan lógica de dominio. Los eventos son el único mecanismo de propagación del lado de escritura al lado de lectura.
4. **Núcleo aislado de la tecnología (arquitectura hexagonal)**: el dominio y la aplicación no dependen de ningún motor, protocolo ni framework; toda infraestructura entra por puertos con adaptadores intercambiables y verificados por contract tests. Ningún invariante del dominio se delega a un adaptador.
5. **Inmutabilidad económica del ledger**: los hechos económicos (postings, montos, fechas contables) de una transacción confirmada no cambian jamás; las correcciones son nuevos eventos (reversas, ajustes). Las anotaciones no económicas (factura, etiquetas) sí pueden agregarse después (ver INV-6).
6. **El extracto bancario es la verdad externa**: el ledger registra lo que realmente ocurrió en las cuentas reales (montos en la moneda de la cuenta) y concilia contra saldos reportados externamente mediante afirmaciones de saldo, con semántica temporal precisa (§2.4).
7. **Separación entre modelo y presentación**: agrupaciones, vistas consolidadas y conversiones de moneda para reportes viven en proyecciones y capa de producto, fuera del núcleo contable.
8. **Agnóstico de la fuente y del cliente**: el ledger trata igual una transacción creada por un humano que una creada por un automatizador. La procedencia es metadata (`client_id` + referencia externa); la identidad y permisos de los clientes son responsabilidad de un servicio externo.
9. **Todo ciclo de vida es completo**: cada concepto que puede crearse define también cómo se corrige, se revoca o se cierra. Lo que Beancount resuelve editando texto, este sistema lo modela como eventos explícitos de corrección y mantenimiento.
10. **Diseñado para evolucionar**: las capacidades diferidas (inversiones con lotes, valoración avanzada) deben poder agregarse de forma aditiva — nuevos tipos de evento y nuevas proyecciones — sin reescribir el historial (ver §9).

---

## 2. Conceptos y definiciones

Terminología del dominio. Los nombres de entidades, eventos y código van en inglés; la descripción conceptual en español.

### 2.1 Account (Cuenta)

Nodo de la jerarquía contable. **No** equivale únicamente a una cuenta bancaria: las categorías de ingreso y gasto también son cuentas. Toda cuenta pertenece a uno de los cinco tipos raíz (tomados de Beancount):

| Tipo raíz | Naturaleza | Ejemplos |
|---|---|---|
| `ASSETS` | Lo que se posee | `Assets:Bancolombia:Ahorros`, `Assets:Nequi`, `Assets:Cash` |
| `LIABILITIES` | Lo que se debe | `Liabilities:Bancolombia:CreditCard` |
| `INCOME` | Fuentes de ingreso | `Income:Salary`, `Income:Freelance` |
| `EXPENSES` | Categorías de gasto | `Expenses:Food:Restaurants`, `Expenses:Subscriptions` |
| `EQUITY` | Patrimonio y ajustes técnicos | `Equity:OpeningBalances`, `Equity:Adjustments` |

Propiedades relevantes:

- **Identidad estable, nombre mutable**: la identidad de una cuenta es su `account_id`; el nombre jerárquico (`Assets:Bancolombia:Ahorros`) es un atributo renombrable (§2.1.1). Los postings referencian el id, nunca el nombre.
- **Jerarquía por nombre**: la ruta implica agrupación bajo el padre, resolviendo la agrupación de múltiples cuentas bancarias de una misma entidad sin estructuras adicionales.
- **Correspondencia 1:1 con cuentas reales**: cada cuenta bancaria, tarjeta o billetera real del usuario se espeja en exactamente una cuenta de tipo `ASSETS` o `LIABILITIES`.
- **Monedas permitidas**: cada cuenta declara la(s) moneda(s) que acepta. Las cuentas reales (`ASSETS`/`LIABILITIES`) se restringen a **una sola moneda**. Las cuentas nominales (`INCOME`/`EXPENSES`) pueden aceptar varias.
- **Ciclo de vida**: apertura y cierre son eventos fechados (equivalentes a `open`/`close` de Beancount). No se registran asientos fuera de ese rango.
- **Cuentas técnicas del sistema**: `Equity:OpeningBalances` (saldos iniciales) y `Equity:Adjustments` (ajustes de conciliación, §2.4.1) se crean automáticamente al inicializar el ledger del usuario y no pueden cerrarse.

#### 2.1.1 Reorganización de cuentas

Renombrar o mover una cuenta dentro de la jerarquía es una operación soportada (`AccountRenamed`): cambia el atributo nombre (y por consistencia, el prefijo de todas sus descendientes) sin afectar ningún posting, puesto que estos referencian `account_id`. El efecto es un rebuild de las proyecciones afectadas. Restricciones: el tipo raíz nunca cambia (una cuenta `EXPENSES` no puede convertirse en `ASSETS`), y el nuevo nombre no puede colisionar con uno existente del usuario.

### 2.2 Transaction (Transacción)

Unidad atómica de registro. Agrupa dos o más asientos (postings) fechados que en conjunto suman cero por cada moneda involucrada.

- No tiene "tipo" almacenado: la clasificación gasto / ingreso / transferencia se **deriva** de los tipos de cuenta que participan (RF-3).
- Distingue **payee** (contraparte/comercio: "Netflix", "Éxito") de **description** (narración libre), siguiendo a Beancount y hledger. El payee es un campo de primera clase: fundamenta reglas de categorización, reportes por comercio y detección de recurrencias.
- Porta metadatos de negocio: URL de factura, tags, procedencia (`client_id`, referencia externa), estado del ciclo de vida.
- Tiene fecha contable (date) y timestamp técnico de ocurrencia para ordenar dentro del día.
- Sus atributos se dividen en **económicos** (postings: cuentas, montos, monedas; fecha contable) — inmutables tras confirmar — y **anotativos** (payee, description, invoice_url, tags, metadata) — enriquecibles en cualquier momento (INV-6).

### 2.3 Posting (Asiento)

Línea individual de una transacción: referencia a una cuenta (`account_id`) + monto con signo + moneda. Monto negativo representa salida de valor de la cuenta; positivo, entrada.

- El monto es siempre el par `(amount, currency)`; nunca existe monto sin moneda.
- Puede portar metadatos propios (ej. monto original en moneda extranjera de una compra internacional, §7.4).
- No tiene estado propio: el estado (pendiente/confirmada) es de la transacción completa (exclusión consciente de los flags por posting de Beancount, §10).

### 2.4 Balance Assertion (Afirmación de saldo)

Checkpoint de conciliación (equivalente a la directiva `balance` de Beancount): declaración de que en un momento dado, una cuenta tenía un saldo determinado según una fuente externa (el banco).

Semántica precisa:

- **Alcance**: la aserción aplica **solo a la cuenta exacta**, nunca incluye subcuentas (regla de Beancount; correcta para conciliación bancaria dado el espejo 1:1).
- **Momento de evaluación**: si la aserción porta `occurred_at` (típico cuando proviene de una notificación bancaria intradía), se evalúa contra las transacciones con `occurred_at` menor o igual; si solo porta fecha, se evalúa **al cierre del día** (todas las transacciones con `date` menor o igual). Las transacciones del día sin `occurred_at` se consideran anteriores a cualquier aserción intradía solo si su orden puede determinarse; en caso contrario la aserción se marca `INDETERMINATE` en lugar de arrojar un falso `MISMATCHED`.
- **Población evaluada**: transacciones `CONFIRMED` y `PENDING` (una pendiente ya debitó dinero real); las `VOIDED` nunca.
- **Tolerancia**: cero por defecto (los datos bancarios son exactos). Configurable por aserción para fuentes imprecisas.
- **Ciclo de vida**: una aserción errónea (typo, correo mal parseado) se revoca (`AssertionRevoked`) y deja de evaluar; la revocación queda en el stream.

#### 2.4.1 Reconciliation Adjustment (Ajuste de conciliación)

Resolución de una discrepancia confirmada como real (equivalente funcional del `pad` de Beancount, generalizado): transacción de sistema entre la cuenta afectada y `Equity:Adjustments`, por el monto exacto de la diferencia, vinculada a la aserción que la motivó. Deja el saldo cuadrado sin inventar un gasto o ingreso ficticio, y la vinculación permite auditar cuánto "dinero sin explicación" ha requerido cada cuenta — un indicador de calidad de la captura. El uso para saldos iniciales (`Equity:OpeningBalances`) es el mismo mecanismo con cuenta de contrapartida distinta.

### 2.5 Commodity / Currency (Moneda)

Unidad de valor, registrada como evento fechado (`CurrencyRegistered`, equivalente a la directiva `commodity` de Beancount) con su precisión (`minor_units`). El sistema es multi-moneda por diseño: `COP`, `USD`, extensible a otras monedas y, a futuro, otros commodities (§9.2). Los montos se representan con aritmética exacta, nunca punto flotante.

### 2.6 Price (Tasa de cambio) — **fuera de alcance (§4.2)**

> Sale junto con la valoración, su único consumidor: una tasa nunca altera un asiento. Se
> conserva como insumo de diseño del módulo de producto.

Registro fechado del valor de una moneda expresado en otra (equivalente a la directiva `price`). Se usa exclusivamente para **valoración en proyecciones y reportes**, nunca para alterar los montos registrados. Una tasa mal cargada se corrige registrando una nueva para la misma fecha y fuente: la vigente es la de mayor posición en el stream (last-write-wins auditado).

### 2.7 Ledger Settings (Configuración del ledger)

Preferencias contables del usuario que el dominio necesita conocer:

- **Moneda de presentación** (`presentation_currency`, equivalente al `operating_currency` de Beancount): moneda de referencia del ledger, que los consumidores usan para valorar y consolidar. Se establece al inicializar el ledger y puede cambiarse (`PresentationCurrencyChanged`); el cambio afecta valoración futura, jamás datos registrados. Este servicio la almacena y la expone; no la aplica (§4.2).
- **Zona horaria** (`timezone`, identificador IANA, ej. `America/Bogota`): todo timestamp del sistema se almacena y procesa **siempre en UTC**; la zona horaria del usuario es el único mecanismo para derivar interpretaciones locales — la fecha contable de una operación capturada por timestamp, y el límite de "cierre del día" en la evaluación de aserciones (§2.4). Cambiarla (`TimezoneChanged`) afecta interpretaciones futuras, jamás eventos registrados.

#### 2.7.1 Precisión y redondeo (adaptación de Beancount)

Beancount acepta montos de precisión arbitraria y compensa con **tolerancias inferidas** de los decimales escritos, porque su input es texto humano heterogéneo. Este sistema recibe datos bancarios (exactos por definición), por lo que adopta la política inversa:

- **Estrictez en el registro**: todo `Money` debe respetar los `minor_units` de su moneda (`100.5 COP` con COP de 0 decimales se rechaza en la construcción del value object). El balanceo (INV-1) es exacto, sin tolerancia.
- **Redondeo solo en valoración**: la conversión a moneda de presentación (saldo USD × tasa → COP en reportes) redondea **half-even** a los `minor_units` de la moneda de presentación, exclusivamente en la capa de lectura; ningún valor redondeado se persiste jamás.
- La cuenta de residuos de redondeo (equivalente al `account_rounding` de Beancount) se difiere hasta la adopción de costos/lotes (§9.2), que es cuando las multiplicaciones cantidad × precio generan residuos dentro de transacciones (§10).

### 2.8 Budget (Presupuesto) — **fuera de alcance (§4.2)**

> Concepto de la capa de producto, no del núcleo contable: un presupuesto no emite postings
> ni altera ningún saldo. Se conserva aquí como insumo de diseño para el módulo que lo
> implemente sobre este API.

Límite de gasto por período (mensual) asociado a una cuenta de tipo `EXPENSES` (y opcionalmente su subárbol), definido en la moneda de presentación. El consumo se calcula desde la proyección de postings del período. Redefinir el presupuesto de un período existente es una modificación explícita (`BudgetAmended`), no un upsert silencioso.

### 2.9 Goal (Meta) — **fuera de alcance (§4.2)**

> Concepto de la capa de producto, por la misma razón que §2.8.

Objetivo de saldo sobre una cuenta de tipo `ASSETS`, con monto objetivo, moneda y fecha límite opcional. El progreso se deriva del saldo proyectado. Ciclo de vida completo: modificable (`GoalAmended`), alcanzada (`GoalAchieved`, marcada por el sistema al detectar el saldo objetivo) y archivable (`GoalArchived`).

### 2.10 Client Id (Procedencia)

Identificador del cliente que originó una operación (frontend, sistema de análisis de correos, otros). Para el ledger es **metadata opaca**: llega ya validado por el servicio externo de autenticación/autorización, se registra en cada evento para auditoría, y el ledger no mantiene registro, ciclo de vida ni credenciales de clientes.

### 2.11 External Reference / Idempotency Key

Identificador provisto por el cliente al ejecutar un comando de escritura, único por usuario. Garantiza idempotencia (reintentos no duplican eventos) y trazabilidad hacia el sistema origen, sin que el ledger conozca la semántica del identificador.

---

## 3. Arquitectura de dominio (DDD + CQRS + Event Sourcing + Hexagonal)

### 3.1 Bounded context

Un único bounded context en este servicio: **Ledger**, acotado a la contabilidad. La identidad/autorización de usuarios y clientes, el análisis de correos, el frontend y la **capa de producto** (presupuestos, metas, valoración, reportes — §4.2) son contexts externos que se integran exclusivamente a través del API (commands y queries).

### 3.2 Patrón CQRS: lados de escritura y lectura

CQRS estructura el servicio en dos lados con responsabilidades, modelos y rutas de ejecución independientes, conectados únicamente por los eventos de dominio:

```
                 ┌──────────────── WRITE SIDE ────────────────┐
  API (POST) ──► Command Bus ──► Command Handler ──► Aggregate
                                       │                 │
                                       │ load events     │ emit events
                                       ▼                 ▼
                                  ┌─────────── Event Store ───────────┐
                                  └───────────────┬───────────────────┘
                                                  │ event stream
                 ┌──────────────── READ SIDE ─────▼──────────┐
                 │   Projectors ──► Read Models (proyecciones)│
  API (GET) ───► Query Bus ──► Query Handler ──► Read Models  │
                 └────────────────────────────────────────────┘
```

**Lado de escritura (command side):**

- Recibe exclusivamente commands (§3.5) a través de un **command bus** que resuelve el handler correspondiente, aplica las políticas transversales (idempotencia por `external_ref`, contexto autenticado, concurrencia optimista) y ejecuta.
- El handler reconstruye el agregado **solo desde sus eventos** en el event store — nunca desde proyecciones — verifica invariantes y emite eventos de forma atómica.
- Un command retorna únicamente el resultado de la operación: identificadores generados, la posición de stream alcanzada (para RNF-9) y errores de dominio. Jamás retorna representaciones de lectura.
- La única lectura permitida en este lado, distinta del propio agregado, es la validación inter-agregado definida en §3.6 (ej. estado de cuentas), acotada y con la semántica de consistencia relajada allí descrita; ningún invariante contable (INV-1) depende de ella.

**Lado de lectura (query side):**

- Recibe exclusivamente queries a través de un **query bus** hacia handlers que consultan las proyecciones (§3.6). Sin lógica de dominio, sin acceso al event store, sin efectos secundarios.
- Los **projectors** son los únicos escritores de los read models: consumen el stream (por posición global, con checkpoint) y materializan las vistas. Un read model jamás se escribe desde un command handler ni desde el API.
- Los read models se optimizan por caso de consulta (desnormalización libre), pueden reconstruirse por replay (RNF-5) y su esquema no está acoplado al de los eventos.

**Reglas de orquestación:**

- Los eventos son el único puente entre lados: no hay llamadas directas del query side al write side ni viceversa.
- Procesos de reacción (las re-evaluaciones de aserciones de §3.6) se modelan como **reactors/process managers**: escuchan eventos y, si corresponde, despachan nuevos commands por el bus — nunca escriben eventos ni proyecciones directamente. Esto mantiene un único camino de escritura auditado.
- El modo de despacho de los projectors (síncrono en la transacción del command para vistas críticas vs. asíncrono con checkpoint) es una decisión de infraestructura por proyección (pregunta abierta #4); el contrato lógico entre lados no cambia.

### 3.3 Agregados

| Agregado | Raíz | Responsabilidad | Invariantes que protege |
|---|---|---|---|
| `Account` | AccountId | Ciclo de vida: apertura, cierre, renombre, monedas permitidas, jerarquía | INV-3 (parcial), INV-4 |
| `LedgerTransaction` | TransactionId | Registro, enmienda, anotación, confirmación, anulación y reversa de una transacción con sus postings | INV-1, INV-2, INV-6 |
| `BalanceAssertion` | AssertionId | Declaración, evaluación y revocación de un checkpoint de conciliación | — |
| `LedgerSettings` | UserId | Moneda de presentación y preferencias contables | — |

`Budget` y `Goal` eran agregados de v1 en la versión 0.7; salieron del alcance (§4.2) y se
modelarán en el módulo de producto.

Notas de diseño:

- **La transacción es el agregado, no el posting**: los postings solo existen dentro de su transacción, lo que hace del balance a cero (INV-1) un invariante *interno* del agregado, verificable de forma síncrona y transaccional al procesar cada comando. Esta es la razón principal por la que event sourcing y partida doble encajan naturalmente: la unidad de consistencia contable y la unidad de persistencia de eventos coinciden.
- **Los saldos no son agregados**: son proyecciones. Ningún comando "escribe un saldo" (INV-5). La validación cruzada que requiere estado fuera del agregado (ej. que la cuenta exista, esté abierta y acepte la moneda) se resuelve consultando el modelo de cuentas al procesar el comando, con las consideraciones de consistencia de §3.5.
- **`Currency`** se modela como dato de referencia event-sourced de forma simple (`CurrencyRegistered`), no como agregado rico: no protege invariantes de negocio complejos. Es parte del núcleo porque `Money` necesita los `minor_units` de cada moneda para la exactitud decimal (INV-8). `Price` (tasas de cambio) seguía el mismo patrón pero salió del alcance junto con la valoración, su único consumidor (§4.2).
- **El ajuste de conciliación no es un agregado**: es una `LedgerTransaction` ordinaria de origen sistema, creada por el command `ResolveDiscrepancy`, vinculada por metadata a su aserción.

### 3.4 Catálogo de eventos de dominio

Todos los eventos portan como sobre (envelope): `event_id`, `aggregate_id`, `aggregate_type`, `sequence` (versión dentro del agregado), `user_id`, `client_id`, `external_ref` (cuando aplica), `occurred_at`, `recorded_at`.

**Cuentas**

| Evento | Contenido esencial |
|---|---|
| `AccountOpened` | type, name, parent, currency(ies), opened_on, is_bank_mirror, is_system |
| `AccountRenamed` | new_name (propaga prefijo a descendientes vía proyección) |
| `AccountClosed` | closed_on |

**Transacciones**

| Evento | Contenido esencial |
|---|---|
| `TransactionRecorded` | date, payee, description, postings[{account_id, amount, currency, metadata}], invoice_url, tags, metadata, initial status |
| `TransactionAmended` | cambios económicos: postings, montos, fecha (solo en `PENDING`) |
| `TransactionAnnotated` | cambios anotativos: payee, description, invoice_url, tags, metadata (permitido en `PENDING` y `CONFIRMED`) |
| `TransactionConfirmed` | postings finales congelados, confirmed_at |
| `TransactionVoided` | motivo (solo `PENDING`) |
| `TransactionReversed` | referencia a la transacción de reversa creada |
| `TransfersMerged` | ids de las dos pendientes anuladas + postings de la transferencia resultante |

**Conciliación**

| Evento | Contenido esencial |
|---|---|
| `BalanceAsserted` | account_id, date, occurred_at?, expected_amount, currency, tolerance |
| `BalanceAssertionEvaluated` | resultado (MATCHED / MISMATCHED / INDETERMINATE), diferencia |
| `AssertionRevoked` | motivo |
| `DiscrepancyResolved` | assertion_id, adjustment_transaction_id |

**Configuración y referencia**

| Evento | Contenido esencial |
|---|---|
| `LedgerInitialized` | presentation_currency, timezone, cuentas técnicas creadas |
| `PresentationCurrencyChanged` | new_currency |
| `TimezoneChanged` | new_timezone (IANA) |
| `CurrencyRegistered` | code, minor_units, name |

**Fuera de alcance (§4.2)** — se conservan como insumo de diseño del módulo de producto:
`PriceRecorded` (base, quote, date, rate, source), `BudgetDefined`/`BudgetAmended`/`BudgetRemoved`
y `GoalDefined`/`GoalAmended`/`GoalAchieved`/`GoalArchived`.

La corrección de una confirmada se materializa como: `TransactionReversed` sobre la original + `TransactionRecorded` de la transacción de reversa (creada por el sistema, vinculada por metadata `reverses_id`). La resolución de una discrepancia se materializa como: `TransactionRecorded` del ajuste contra `Equity:Adjustments` + `DiscrepancyResolved` sobre la aserción.

### 3.5 Commands (superficie de escritura del dominio)

`InitializeLedger`, `OpenAccount`, `RenameAccount`, `CloseAccount`, `RecordTransaction`, `AmendPendingTransaction`, `AnnotateTransaction`, `ConfirmTransaction`, `VoidPendingTransaction`, `ReverseConfirmedTransaction`, `MergePendingTransfers`, `AssertBalance`, `RevokeAssertion`, `ResolveDiscrepancy`, `ChangePresentationCurrency`, `ChangeTimezone`, `RegisterCurrency`.

Fuera de alcance (§4.2): `RecordPrice`, `DefineBudget`, `AmendBudget`, `RemoveBudget`, `DefineGoal`, `AmendGoal`, `ArchiveGoal`.

Cada command: valida contra el estado actual del agregado (reconstruido desde sus eventos), verifica los invariantes, y emite cero o más eventos de forma atómica con control de concurrencia optimista (`sequence` esperado).

### 3.6 Proyecciones (read models)

Las proyecciones se construyen consumiendo el event stream y son **totalmente reconstruibles** (RNF-5). Proyecciones de v1:

| Proyección | Alimentada por | Sirve a |
|---|---|---|
| `account_tree` | AccountOpened/Renamed/Closed | Listados, validación de jerarquía y nombres |
| `transaction_list` | Transaction* / TransfersMerged | Consultas con filtros (incl. payee) y paginación |
| `account_balances` | TransactionConfirmed/Reversed (y pendientes por separado) | Saldos por cuenta+moneda |
| `pending_review` | TransactionRecorded/Amended/Voided/Confirmed | Bandeja de pendientes del frontend |
| `assertion_status` | BalanceAsserted/Evaluated/Revoked + balances | Conciliación, discrepancias y su resolución |
| `adjustment_audit` | DiscrepancyResolved + ajustes | Indicador de "dinero sin explicación" por cuenta |
| `ledger_settings` | LedgerInitialized/PresentationCurrencyChanged/TimezoneChanged | Moneda de presentación, zona horaria y cuentas técnicas |
| `currencies` | CurrencyRegistered | Catálogo de monedas con sus `minor_units` (INV-8) |

Fuera de alcance (§4.2): `transfer_candidates` (propuestas de transferencia, RF-15),
`budget_consumption` (RF-24) y `net_worth` (RF-23).

Consideraciones de consistencia:

- **Escrituras**: fuertemente consistentes dentro del agregado (el balance a cero jamás depende de una proyección).
- **Lecturas**: eventualmente consistentes. Para la experiencia de usuario (crear y ver de inmediato), las proyecciones críticas (`transaction_list`, `account_balances`) se actualizan de forma síncrona en el mismo proceso del command o con lag acotado; el contrato del API expone la posición del stream para que los clientes puedan leer su propia escritura.
- **Validaciones inter-agregado** (cuenta abierta, moneda permitida, unicidad de nombre al renombrar): se validan contra el estado de cuentas al procesar el comando. Dado que los cambios de cuentas son de baja frecuencia y controlados por el mismo usuario, la ventana de carrera es aceptable; el caso residual se detecta y se expone como discrepancia, no como corrupción — el evento queda en el stream y la corrección es una reversa.
- **Re-evaluación de aserciones**: cualquier evento que altere postings de una cuenta con aserciones posteriores a la fecha afectada dispara la re-evaluación de esas aserciones (una aserción `MATCHED` puede pasar a `MISMATCHED` si se revierte una transacción anterior a ella).

### 3.7 Arquitectura hexagonal (ports & adapters)

El servicio se estructura como un hexágono: el **núcleo** (Domain + Application) no depende de ninguna tecnología concreta — ni PostgreSQL, ni HTTP, ni serialización específica — y toda interacción con el exterior atraviesa **puertos** (interfaces declaradas por el núcleo) implementados por **adaptadores** en Infrastructure.

**Núcleo (dentro del hexágono):**

- **Domain**: agregados, value objects (`Money`, `AccountName`, `Payee`, `PostingLine`), eventos, servicios de dominio (derivador de tipo de transacción, detector de transferencias, evaluador de aserciones, propagador de renombres).
- **Application (write side)**: command handlers (validación de aplicación, idempotencia, coordinación), reactors/process managers (§3.2), y la **lógica de los projectors** (mapeo evento → vista): es código del núcleo aunque su ejecución la orqueste un adaptador.
- **Application (read side)**: query handlers sobre los puertos de read models.

**Adaptadores conductores (driving) — traducen el exterior a casos de uso:**

- Controladores REST: HTTP → command bus / query bus. Un futuro adaptador gRPC, CLI o de mensajería usa los mismos puertos sin tocar el núcleo.
- El poller de proyección asíncrona: invoca la lógica de projectors del núcleo desde el stream con checkpoint.

**Adaptadores conducidos (driven) — implementan los puertos del núcleo:**

- `PostgresEventStore`: el esquema de §6.1 es *esta implementación*, no el diseño del núcleo. El trigger append-only y los índices únicos son defensa en profundidad del adaptador (RNF-1); ningún invariante del dominio depende de ellos.
- `PostgresReadModels`: el esquema de §6.2.
- Adaptadores **in-memory** de ambos puertos: habilitan testear dominio y aplicación completos (incluyendo replay y rebuild) sin infraestructura — el beneficio cotidiano principal del patrón.

### 3.8 Puertos del núcleo

| Puerto | Operaciones esenciales | Semántica contractual clave |
|---|---|---|
| `EventStore` | `append(aggregateId, expectedVersion, events[])`, `load(aggregateId)`, `readAll(fromPosition)` | Excepción tipada ante conflicto de concurrencia; ante `external_ref` duplicada retorna el resultado original (idempotencia observable, INV-10); `readAll` garantiza orden por posición global |
| `ReadModelStore` (o puertos por proyección) | upsert/delete de vistas, queries tipadas, `truncate` (rebuild) | Sin lógica de negocio; escritura permitida solo a projectors (RNF-10) |
| `ProjectionDispatcher` | despacho de eventos a projectors, gestión de checkpoints | El **mismo código de projector** corre en modo síncrono (misma transacción del command) o asíncrono (poller con checkpoint): el modo es configuración del adaptador por proyección, nunca una bifurcación del núcleo |
| `Clock`, `IdGenerator` | ahora, uuid | Deterministas en tests |

Los contratos se especifican con semántica completa (excepciones, orden, idempotencia) y se verifican con **contract tests**: la misma suite corre contra el adaptador PostgreSQL y el in-memory, garantizando sustituibilidad real. Precisión honesta sobre la intercambiabilidad: el puerto hace intercambiable el *código* (otro motor de event store es un adaptador nuevo) y testeable el núcleo; el *stream persistido* sigue siendo la fuente de verdad, y migrarlo entre motores es un proyecto de ETL independiente de la limpieza de la interfaz.

---

## 4. Alcance

### 4.1 Dentro del alcance (v1)

**Criterio de inclusión:** entra al servicio lo que **genera o valida un asiento contable**,
más los parámetros que el núcleo necesita para operar (zona horaria, monedas). Todo lo demás
es capa de producto y vive fuera (§4.2).

- Ledger de partida doble multi-moneda con los cinco tipos de cuenta, jerarquía por nombre y reorganización (renombre) de cuentas, implementado con event sourcing según §3.
- API REST para todos los commands y queries del dominio.
- Ciclo de vida completo de transacción: `PENDING → CONFIRMED`, enmienda económica solo en pendiente, anotación en cualquier estado, anulación de pendientes, reversa de confirmadas.
- Idempotencia genérica por referencia externa en todos los commands.
- Command de fusión de dos pendientes en una transferencia confirmada (RF-16), con validación de que el par es contablemente legítimo. **Sin** detección heurística: proponer qué fusionar es del cliente (§4.2).
- Conciliación completa: afirmaciones de saldo con semántica temporal definida (§2.4), evaluación y re-evaluación, revocación de aserciones erróneas y resolución de discrepancias mediante ajustes contra `Equity:Adjustments`.
- Inicialización del ledger con cuentas técnicas y moneda de presentación; saldos iniciales contra `Equity:OpeningBalances`.
- Configuración del ledger: moneda de presentación y zona horaria (la zona horaria es el parámetro del que RNF-7 deriva el cierre del día para las aserciones).
- Catálogo de monedas con sus `minor_units`: lo exige `Money` para la exactitud decimal (INV-8, RNF-2).
- Payee como campo de primera clase en transacciones.
- Registro de `client_id` como metadata de procedencia en todos los eventos.
- Proyecciones de lectura del núcleo: árbol de cuentas, saldo por cuenta y moneda, listado de transacciones con filtros y paginación, estado de conciliación y auditoría de ajustes.

### 4.2 Fuera del alcance (v1)

**Capa de producto — sale del servicio en la versión 0.8** (ver `decisions.md`, 2026-07-25).
No es funcionalidad descartada: es funcionalidad que pertenece a otro componente, construido
sobre este API. El diseño de cada concepto se conserva en este documento.

- **Presupuestos** (§2.8, RF-24) y **metas** (§2.9, RF-25): no emiten postings ni alteran saldos; son planificación sobre proyecciones.
- **Valoración y patrimonio neto** (RF-23): el principio de diseño **#7** ya ubica las conversiones de moneda para reportes «fuera del núcleo contable».
- **Reportes consolidados** (`/reports/*`): gastos por categoría, período y payee; patrimonio. Mismo fundamento que el punto anterior. La *auditoría de ajustes* sí se queda: es trazabilidad contable, no reporte de producto.
- **Registro de tasas de cambio** (§2.6, RF-22): dato de referencia externo cuyo único consumidor era la valoración.
- **Detección de candidatos a transferencia** (RF-15): heurística con ventana temporal calibrable, no regla contable. El ledger expone las pendientes vía `GET /transactions?status=PENDING`; proponer pares es del cliente. La *fusión* (RF-16) sí se queda: anular dos pendientes y registrar una transferencia son operaciones contables.

**Fuera del alcance desde la versión 0.7:**

- **Análisis y sincronización de correos electrónicos**: responsabilidad de un sistema independiente que consume el API de este servicio.
- **Gestión de identidad, autenticación y autorización** de usuarios y clientes: responsabilidad de un servicio externo. El ledger asume que toda petición llega autenticada, con `user_id` y `client_id` resueltos y validados; se limita a exigir su presencia y registrarlos.
- **Sugerencia automática de categorías**: responsabilidad de los clientes (frontend o automatizadores) o de un servicio futuro. El ledger aporta los datos que la hacen posible (payee, historial consultable) pero no implementa el motor de reglas ni aprendizaje.
- Inversiones con lotes y costo de adquisición (mecanismo `{cost}` de Beancount). Diferido; ver ruta de evolución en §9.2.
- Conexión a APIs bancarias / Open Finance (Belvo, Prometeo).
- Presupuestos multi-moneda nativos (redundante desde 0.8: los presupuestos completos salieron del alcance).
- Parsing del contenido de facturas (solo se almacena la URL).
- Compartir ledgers entre usuarios, cuentas conjuntas.
- Importación de formatos externos (OFX, CSV, camt.053) como funcionalidad propia; un cliente externo puede implementarla consumiendo el API.
- Frontend: el contrato del API se diseña pensando en él, pero su implementación es un proyecto aparte.

Las exclusiones de conceptos específicos de Beancount/hledger evaluados y descartados conscientemente se documentan en §10.

### 4.3 Decisiones explícitas de simplificación

| Decisión | Justificación | Reversibilidad |
|---|---|---|
| Cuentas reales mono-moneda | Refleja la realidad bancaria; elimina inventarios multi-moneda por cuenta | Alta: relajar la regla del agregado Account |
| Transacciones con N postings (no limitado a 2) | Costo bajo y habilita compras divididas en categorías | — |
| Sin mecanismo de costo/lotes en v1 | Complejidad alta sin caso de uso actual; diseño preparado (§9.2) | Alta por diseño |
| Pagos internacionales desde cuentas COP registrados 100% en COP | La conciliación contra extracto exige registrar lo que realmente salió; el monto original es metadato | — |
| ~~Detección de transferencias en el ledger (no en el cliente)~~ **Revertida en 0.8**: la detección es del cliente; el ledger solo valida la fusión | La ventana temporal era una heurística calibrable (pregunta abierta #4, nunca resuelta), no una regla contable | Ejercida |
| ~~Un solo bounded context (Ledger) con producto embebido~~ **Revertida en 0.8**: el producto sale a su propio componente | La concesión de v1 contradecía el principio #7; se ejerció la salida antes de construirlo, no después | Ejercida |
| Validación inter-agregado con consistencia relajada (§3.5) | Frecuencia de cambio de cuentas mínima; el fallo degrada a discrepancia detectable, nunca a corrupción | — |
| Aserción sobre cuenta exacta, sin subcuentas | Regla de Beancount; correcta para conciliación bancaria con espejo 1:1 | Media: variante con subárbol como feature nueva |
| Estado por transacción, no por posting | Simplifica el ciclo de vida; los flags por posting de Beancount no aportan al caso de uso | Baja necesidad |

---

## 5. Requerimientos

### 5.1 Invariantes del núcleo (no negociables)

- **INV-1**: Para toda transacción y para cada moneda presente en ella, la suma de los montos de sus postings es exactamente cero. Se verifica en el agregado `LedgerTransaction` antes de emitir cualquier evento que cree o modifique postings.
- **INV-2**: Toda transacción tiene al menos dos postings.
- **INV-3**: Todo posting referencia por id una cuenta existente y abierta a la fecha de la transacción.
- **INV-4**: La moneda de un posting pertenece a las monedas permitidas de su cuenta.
- **INV-5**: Todo saldo es una proyección derivada de eventos. Ningún command escribe saldos.
- **INV-6**: Los atributos **económicos** (postings, montos, monedas, fecha contable) de una transacción `CONFIRMED` son inmutables: no admiten `TransactionAmended`; correcciones solo mediante reversa vinculada. Los atributos **anotativos** (payee, description, invoice_url, tags, metadata) admiten `TransactionAnnotated` en cualquier estado no `VOIDED`.
- **INV-7**: Los eventos producidos por un command se persisten atómicamente, con control de concurrencia optimista por agregado.
- **INV-8**: Los montos se representan con aritmética exacta y respetan los `minor_units` de su moneda: el value object `Money` rechaza en construcción tanto valores de punto flotante como escalas superiores a la precisión de la moneda (§2.7.1). Prohibido punto flotante en almacenamiento, cálculo y serialización.
- **INV-9**: Todo evento pertenece a un único usuario; ninguna query ni proyección cruza usuarios.
- **INV-10**: Todo command con referencia externa es idempotente: repetirlo con la misma referencia no emite nuevos eventos.
- **INV-11**: La lógica de balanceo (INV-1) reside en un único componente del dominio, extensible para futuros modos de balance (ver §9.2).
- **INV-12**: El event stream es append-only. No existen operaciones de edición o borrado de eventos en ninguna capa del sistema.
- **INV-13**: Las cuentas técnicas del sistema (`Equity:OpeningBalances`, `Equity:Adjustments`) existen desde la inicialización del ledger, no pueden cerrarse ni renombrarse, y solo reciben postings de transacciones de origen sistema.
- **INV-14**: El tipo raíz de una cuenta es inmutable; el renombre nunca lo altera.

### 5.2 Requerimientos funcionales

**Ledger y cuentas**

- **RF-1**: Gestión de cuentas: apertura, renombre (con propagación a descendientes), cierre y organización jerárquica bajo los cinco tipos raíz, con declaración de moneda(s).
- **RF-2**: Inicialización del ledger por usuario: cuentas técnicas y moneda de presentación (modificable después).

**Transacciones**

- **RF-3**: Registro de transacciones vía API con payee, description y postings explícitos, en estado `PENDING` o directamente `CONFIRMED` según indique el cliente.
- **RF-4**: Derivación del tipo presentacional: participa `EXPENSES` → gasto; participa `INCOME` → ingreso; solo `ASSETS`/`LIABILITIES` → transferencia; combinaciones no clasificables → compuesta (nunca error).
- **RF-5**: Las transferencias entre cuentas propias no computan en reportes de gasto/ingreso ni en presupuestos.
- **RF-6**: Enmienda económica de pendientes; prohibida tras confirmar. Anotación (payee, factura, tags, metadata) permitida también sobre confirmadas.
- **RF-7**: Corrección de confirmadas exclusivamente mediante reversa vinculada, con trazabilidad entre ambas.
- **RF-8**: Anulación (`VOIDED`) disponible solo para transacciones `PENDING`.
- **RF-9**: URL de factura, tags y metadatos arbitrarios clave-valor a nivel de transacción y de posting.
- **RF-10**: Soporte de transacciones con más de dos postings.

**API y procedencia**

- **RF-11**: Todo command acepta una referencia externa opcional (obligatoria para clientes automatizados) que garantiza idempotencia por usuario (INV-10).
- **RF-12**: Todo evento registra el `client_id` recibido y la referencia externa, consultables para auditoría. El ledger no valida ni administra la identidad del cliente.
- **RF-13**: Queries de transacciones con filtros (cuenta, período, estado, tipo derivado, payee, `client_id` origen) y paginación, servidas desde proyecciones.
- **RF-14**: Los errores de dominio se reportan con códigos estables y accionables.

**Transferencias**

- **RF-15** — **fuera de alcance (§4.2)**: Detección de pares de pendientes candidatas a transferencia (montos opuestos, misma moneda, cuentas reales distintas, ventana temporal configurable), expuesta como proyección de propuestas.
- **RF-16**: Command de fusión: anula las dos pendientes y registra una única transferencia confirmada, conservando las referencias externas de ambas en metadata. El servicio **valida** que el par sea legítimo (montos opuestos que netean a cero, misma moneda, cuentas reales distintas) sobre las dos transacciones que el cliente nombra; no las descubre por su cuenta.

**Conciliación**

- **RF-17**: Registro de afirmaciones de saldo vía API con referencia externa idempotente, con la semántica temporal, de alcance y tolerancia de §2.4.
- **RF-18**: Evaluación de aserciones contra el saldo proyectado (resultados `MATCHED`/`MISMATCHED`/`INDETERMINATE`, con diferencia exacta) y re-evaluación automática cuando eventos posteriores alteran postings anteriores a una aserción.
- **RF-19**: Revocación de aserciones erróneas, con motivo auditado.
- **RF-20**: Resolución de discrepancias mediante ajuste de sistema contra `Equity:Adjustments`, vinculado a la aserción; auditoría de ajustes acumulados por cuenta.

**Multi-moneda y valoración**

- **RF-21**: Todo monto porta su moneda. Las cuentas reales operan en su única moneda declarada. El registro de monedas es un evento fechado.
- **RF-22** — **fuera de alcance (§4.2)**: Registro de tasas de cambio fechadas vía API, con corrección por superposición auditada (§2.6).
- **RF-23** — **fuera de alcance (§4.2)**: Los reportes consolidados valoran saldos en la moneda de presentación usando la tasa vigente a la fecha del reporte, sin modificar eventos.

**Presupuestos y metas** — **fuera de alcance (§4.2)**

- **RF-24** — **fuera de alcance**: Presupuestos mensuales por cuenta de gasto (con agregación jerárquica opcional), con consumo proyectado distinguiendo confirmados de pendientes; modificación explícita del presupuesto de un período existente.
- **RF-25** — **fuera de alcance**: Metas de saldo sobre cuentas de activos con progreso derivado, modificación, detección de logro y archivo.

**Plataforma**

- **RF-26**: El API exige en toda petición un contexto autenticado (`user_id`, `client_id`) provisto por la infraestructura externa; peticiones sin contexto válido se rechazan.
- **RF-27**: Saldos iniciales de cuentas preexistentes mediante transacción de apertura contra `Equity:OpeningBalances`.

### 5.3 Requerimientos no funcionales

- **RNF-1 (Integridad)**: Los invariantes se refuerzan en el dominio y, donde sea posible, también en el almacenamiento (unicidad de `(aggregate_id, sequence)`, unicidad de `(user_id, external_ref)`, append-only del event store).
- **RNF-2 (Exactitud monetaria)**: Serialización de montos en los eventos como decimales exactos (string decimal o entero en unidad mínima), respetando los decimales de cada moneda (COP 0, USD 2). Prohibido float en serialización.
- **RNF-3 (Auditabilidad)**: El event stream es la auditoría: procedencia, timestamps, cadena de correcciones, revocaciones y ajustes quedan registrados por construcción.
- **RNF-4 (Idempotencia)**: Reprocesar cualquier lote de commands con las mismas referencias externas no altera el estado final.
- **RNF-5 (Reconstruibilidad)**: Toda proyección puede regenerarse desde el event stream (replay); existe tooling de rebuild y verificación de consistencia entre proyecciones y stream.
- **RNF-6 (Evolución de eventos)**: Los eventos se versionan (`event_type` + `schema_version`); los cambios de esquema se manejan con upcasting en deserialización. Nunca se migran eventos in situ.
- **RNF-7 (Tiempo)**: Todo timestamp se almacena y procesa en **UTC exclusivamente**; ninguna capa persiste horas locales. Las interpretaciones locales (fecha contable derivada de un timestamp, cierre del día para aserciones) se calculan al vuelo desde la zona horaria configurada en `LedgerSettings` (§2.7). Las fechas contables (`date`) son fechas planas sin zona.
- **RNF-8 (Contrato estable)**: El API se versiona; cambios incompatibles requieren nueva versión.
- **RNF-9 (Consistencia de lectura)**: El API permite a un cliente leer sus propias escrituras (posición de stream o proyección síncrona para las vistas críticas).
- **RNF-10 (Segregación CQRS)**: Las queries se sirven exclusivamente desde read models, sin lógica de dominio ni acceso al event store, y no tienen efectos secundarios. Los commands no retornan representaciones de lectura (solo identificadores, posición de stream y errores). Los projectors son los únicos escritores de los read models, y los reactors solo despachan commands, nunca escriben eventos ni proyecciones directamente (§3.2). El event store no es consultable por clientes del API.
- **RNF-11 (Aislamiento hexagonal)**: El núcleo (Domain + Application) no tiene dependencias de infraestructura: ni drivers de base de datos, ni framework HTTP, ni serialización concreta. Todo acceso externo atraviesa los puertos de §3.8. Cada puerto define su semántica contractual completa y se verifica con contract tests que corren idénticos contra el adaptador real (PostgreSQL) y el in-memory. El núcleo completo es testeable sin infraestructura.
- **RNF-12 (Observabilidad)**: Instrumentación con **OpenTelemetry** (trazas, métricas y logs correlacionados). Trazas por command y query con atributos de dominio (tipo de command, agregado, `client_id`); las señales imprescindibles del diseño se exponen como métricas: **lag de proyecciones asíncronas** (checkpoint vs. posición global del stream), **tasa de conflictos de concurrencia optimista**, y **errores de projectors y reactors** (un reactor fallando silenciosamente rompe la re-evaluación de aserciones sin síntoma visible). La instrumentación vive en adaptadores y decoradores de los buses, nunca dentro del dominio (RNF-11).

---

## 6. Propuesta de modelado de datos

Motor de referencia: **PostgreSQL**, cumpliendo dos roles separados: **event store** (fuente de verdad, append-only) y **almacenamiento de proyecciones** (derivado, reconstruible).

### 6.1 Event store

```sql
CREATE TABLE event_store (
    global_position  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id         UUID NOT NULL UNIQUE,
    user_id          UUID NOT NULL,
    aggregate_type   TEXT NOT NULL,          -- 'Account', 'LedgerTransaction', ...
    aggregate_id     UUID NOT NULL,
    sequence         BIGINT NOT NULL,        -- version within the aggregate
    event_type       TEXT NOT NULL,          -- 'TransactionRecorded', ...
    schema_version   SMALLINT NOT NULL DEFAULT 1,
    client_id        TEXT NOT NULL,          -- opaque provenance metadata
    external_ref     TEXT,                   -- client idempotency key
    payload          JSONB NOT NULL,         -- amounts serialized as decimal strings
    occurred_at      TIMESTAMPTZ NOT NULL,
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Optimistic concurrency per aggregate
    UNIQUE (aggregate_id, sequence)
);

-- Idempotency (INV-10): one command per external reference per user
CREATE UNIQUE INDEX idx_event_external_ref
    ON event_store (user_id, external_ref)
    WHERE external_ref IS NOT NULL;

CREATE INDEX idx_event_aggregate ON event_store (aggregate_id, sequence);
CREATE INDEX idx_event_user      ON event_store (user_id, global_position);

-- INV-12: append-only enforced at the storage level
CREATE OR REPLACE FUNCTION reject_event_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'event_store is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_store_immutable
    BEFORE UPDATE OR DELETE ON event_store
    FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();

-- Projection checkpoints (rebuild / catch-up)
CREATE TABLE projection_checkpoints (
    projection_name  TEXT PRIMARY KEY,
    last_position    BIGINT NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ejemplo de payload de `TransactionRecorded` (montos como strings decimales, RNF-2):

```json
{
  "date": "2026-07-20",
  "payee": "Netflix",
  "description": "Monthly subscription",
  "status": "PENDING",
  "invoice_url": null,
  "tags": ["subscription"],
  "postings": [
    { "account_id": "…", "amount": "-31900", "currency": "COP", "metadata": {} },
    { "account_id": "…", "amount": "31900",  "currency": "COP",
      "metadata": { "original_amount": "7.99", "original_currency": "USD", "provisional": true } }
  ],
  "metadata": {}
}
```

### 6.2 Proyecciones (esquema de lectura)

Tablas derivadas, sin constraints de negocio (la verdad vive en el stream), optimizadas para consulta. Núcleo de v1:

```sql
-- Account tree
CREATE TABLE proj_accounts (
    account_id      UUID PRIMARY KEY,
    user_id         UUID NOT NULL,
    type            TEXT NOT NULL,
    name            TEXT NOT NULL,           -- 'Assets:Bancolombia:Savings' (renameable)
    parent_id       UUID,
    currency_code   TEXT,                    -- NULL = multi-currency (nominal accounts)
    opened_on       DATE NOT NULL,
    closed_on       DATE,
    is_bank_mirror  BOOLEAN NOT NULL,
    is_system       BOOLEAN NOT NULL DEFAULT FALSE
);

-- Transaction list (denormalized for querying)
CREATE TABLE proj_transactions (
    transaction_id  UUID PRIMARY KEY,
    user_id         UUID NOT NULL,
    date            DATE NOT NULL,
    occurred_at     TIMESTAMPTZ,
    payee           TEXT,
    description     TEXT NOT NULL,
    status          TEXT NOT NULL,           -- PENDING | CONFIRMED | VOIDED
    derived_kind    TEXT NOT NULL,           -- EXPENSE | INCOME | TRANSFER | COMPOUND
    invoice_url     TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    client_id       TEXT NOT NULL,
    external_ref    TEXT,
    reverses_id     UUID,
    metadata        JSONB NOT NULL
);

CREATE TABLE proj_postings (
    posting_id      UUID PRIMARY KEY,
    transaction_id  UUID NOT NULL,
    user_id         UUID NOT NULL,
    account_id      UUID NOT NULL,
    amount          NUMERIC(20, 6) NOT NULL,
    currency_code   TEXT NOT NULL,
    status          TEXT NOT NULL,           -- denormalized from transaction
    date            DATE NOT NULL,
    metadata        JSONB NOT NULL
);

CREATE INDEX idx_proj_postings_account ON proj_postings (account_id, date);
CREATE INDEX idx_proj_txn_user_date    ON proj_transactions (user_id, date);
CREATE INDEX idx_proj_txn_payee        ON proj_transactions (user_id, payee);

-- Balances per account + currency (confirmed and pending tracked separately)
CREATE TABLE proj_balances (
    account_id       UUID NOT NULL,
    currency_code    TEXT NOT NULL,
    confirmed_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
    pending_amount   NUMERIC(20, 6) NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (account_id, currency_code)
);

-- Reconciliation status
CREATE TABLE proj_assertions (
    assertion_id     UUID PRIMARY KEY,
    user_id          UUID NOT NULL,
    account_id       UUID NOT NULL,
    date             DATE NOT NULL,
    occurred_at      TIMESTAMPTZ,
    expected_amount  NUMERIC(20, 6) NOT NULL,
    currency_code    TEXT NOT NULL,
    tolerance        NUMERIC(20, 6) NOT NULL DEFAULT 0,
    status           TEXT NOT NULL,          -- UNCHECKED | MATCHED | MISMATCHED | INDETERMINATE | REVOKED
    difference       NUMERIC(20, 6),
    resolved_by_txn  UUID,                   -- adjustment transaction, if resolved
    checked_at       TIMESTAMPTZ
);

-- Ledger settings (one row per user; also holds the technical account ids)
CREATE TABLE proj_ledger_settings (
    user_id                     UUID PRIMARY KEY,
    presentation_currency       TEXT NOT NULL,
    timezone                    TEXT NOT NULL,   -- IANA identifier, e.g. 'America/Bogota'
    opening_balances_account_id UUID NOT NULL,
    adjustments_account_id      UUID NOT NULL,
    is_initialized              BOOLEAN NOT NULL DEFAULT FALSE
);

-- proj_currencies (catálogo con minor_units) y adjustment_audit siguen el mismo
-- patrón y se omiten por brevedad.
-- Fuera de alcance (§4.2): proj_prices, proj_budgets (+ consumption), proj_goals,
-- proj_transfer_candidates.
```

### 6.3 Notas de modelado

- **Constraints en proyecciones**: deliberadamente mínimos. La integridad de negocio se garantiza en los agregados antes de emitir eventos; las proyecciones solo reflejan. Un bug de proyección se corrige con rebuild, nunca editando datos.
- **Derivación del tipo (`derived_kind`)**: calculada por el proyector a partir de los tipos de cuenta de los postings; combinaciones desconocidas → `COMPOUND` (preparación para §9.2).
- **Renombre de cuentas**: `AccountRenamed` actualiza `proj_accounts.name` de la cuenta y el prefijo de sus descendientes; ninguna otra proyección cambia porque todas referencian `account_id`.
- **Compra internacional**: el posting registra el monto COP realmente debitado; el monto original va en metadata del posting. La tasa implícita del banco queda derivable desde esa metadata para analítica externa. El ajuste del monto provisional es un `AmendPendingTransaction`; adjuntar la factura después de confirmar es un `AnnotateTransaction`.
- **Fusión de transferencias**: el command `MergePendingTransfers` emite `TransactionVoided` × 2 y `TransactionRecorded` (+`TransactionConfirmed`) de la transferencia, en una única operación atómica sobre el stream. Antes de emitir nada valida el par contra los dos agregados que carga desde el stream —nunca contra una proyección (RNF-10)—: montos opuestos que netean a cero, misma moneda, cuentas reales distintas, ambas todavía `PENDING`.
- **Ajuste de conciliación**: `ResolveDiscrepancy` emite `TransactionRecorded`+`Confirmed` (origen sistema, contra `Equity:Adjustments`) y `DiscrepancyResolved` sobre la aserción; `proj_assertions.resolved_by_txn` los vincula.
- **Snapshots de agregados**: no se implementan en v1 (los agregados tienen pocos eventos cada uno). Se documenta como optimización futura si aparecieran agregados de larga vida.

---

## 7. Contrato del API (superficie funcional)

El API traduce recursos REST a commands y queries del dominio. El detalle de payloads se define en la especificación OpenAPI del proyecto.

| Recurso | Operaciones | Command/Query subyacente |
|---|---|---|
| `/ledger/initialize` | inicializar ledger del usuario | InitializeLedger |
| `/ledger/settings` | consultar, cambiar moneda de presentación y zona horaria | ChangePresentationCurrency, ChangeTimezone / proj_ledger_settings |
| `/accounts` | crear, listar (árbol/plano), renombrar, cerrar, consultar saldo | OpenAccount, RenameAccount, CloseAccount / account_tree, account_balances |
| `/transactions` | crear, listar/filtrar (incl. payee), consultar | RecordTransaction / transaction_list |
| `/transactions/{id}/amend` | ajustar pendiente (económico) | AmendPendingTransaction |
| `/transactions/{id}/annotate` | anotar (payee, factura, tags) en cualquier estado | AnnotateTransaction |
| `/transactions/{id}/confirm` | confirmar | ConfirmTransaction |
| `/transactions/{id}/void` | anular pendiente | VoidPendingTransaction |
| `/transactions/{id}/reverse` | revertir confirmada | ReverseConfirmedTransaction |
| `/transfers/merge` | fusionar dos pendientes que el cliente nombra | MergePendingTransfers |
| `/balance-assertions` | crear, listar, consultar estado | AssertBalance / assertion_status |
| `/balance-assertions/{id}/revoke` | revocar aserción errónea | RevokeAssertion |
| `/balance-assertions/{id}/resolve` | resolver discrepancia con ajuste | ResolveDiscrepancy |
| `/currencies` | registrar, listar | RegisterCurrency / proj_currencies |

Fuera de alcance (§4.2), a implementar por el módulo de producto sobre este API:
`/transfers/candidates`, `/prices`, `/budgets`, `/goals`, `/reports/*`.

Consideraciones transversales:

- Toda petición llega con contexto autenticado (`user_id`, `client_id`) resuelto por la infraestructura externa (gateway/servicio de identidad); el ledger lo exige y lo propaga a los eventos (RF-26, RF-12).
- Idempotencia por `external_ref` en todos los commands (INV-10).
- Errores de dominio con código estable (RF-14): `UNBALANCED_TRANSACTION`, `ACCOUNT_CLOSED`, `CURRENCY_NOT_ALLOWED`, `DUPLICATE_EXTERNAL_REF`, `IMMUTABLE_TRANSACTION`, `CONCURRENCY_CONFLICT`, `NAME_COLLISION`, `SYSTEM_ACCOUNT_PROTECTED`, etc.
- Lectura de escrituras propias vía posición de stream o proyección síncrona (RNF-9).
- Versionado del API (RNF-8).

### 7.1 Flujo: cliente automatizado registra un movimiento

```
Sistema externo (análisis de correos)
   → POST /transactions   [contexto: user_id, client_id]
     { external_ref, date, payee, description, status: PENDING, postings: [...] }
     → RecordTransaction → TransactionRecorded
   → [si el dato existe] POST /balance-assertions { external_ref, account, expected, occurred_at }
     → AssertBalance → BalanceAsserted → BalanceAssertionEvaluated
Usuario (frontend)
   → revisa bandeja de pendientes (pending_review)
   → POST /transactions/{id}/confirm { postings con la categoría real }
     → ConfirmTransaction → TransactionConfirmed
   → [días después llega la factura] POST /transactions/{id}/annotate { invoice_url }
     → AnnotateTransaction → TransactionAnnotated
```

### 7.2 Flujo: transferencia entre cuentas propias

```
Dos POST /transactions independientes (salida en A, entrada en B) → PENDING
   → el cliente identifica el par (GET /transactions?status=PENDING).
     Proponer candidatos es del cliente, no del ledger (§4.2, RF-15)
   → POST /transfers/merge { pending_ids: [t1, t2] }
     → MergePendingTransfers carga ambos agregados desde el stream y valida:
       ambos PENDING, montos opuestos que netean a cero, misma moneda,
       cuentas reales distintas
     → TransactionVoided(t1), TransactionVoided(t2),
       TransactionRecorded+Confirmed(transferencia [A: -X, B: +X])
```

### 7.3 Flujo: corrección de una confirmada

```
POST /transactions/{id}/reverse
   → ReverseConfirmedTransaction
   → TransactionReversed(T1) + TransactionRecorded(T2 = reversa, metadata.reverses_id = T1)
   → [opcional] cliente registra T3 con los valores correctos
   → proyecciones netean T1 + T2; el stream conserva la historia completa
   → aserciones posteriores a T1 se re-evalúan automáticamente (RF-18)
```

### 7.4 Flujo: compra internacional con cargo provisional

```
Cliente externo registra PENDING con monto COP provisional
   + metadata { original_amount, original_currency, provisional: true }
   → llega el asiento definitivo → POST /transactions/{id}/amend (monto final)
   → POST /transactions/{id}/confirm → postings congelados
```

### 7.5 Flujo: conciliación con discrepancia real

```
Aserción evaluada → MISMATCHED (diferencia: -12.500 COP)
   → usuario investiga: no encuentra el movimiento faltante
   → POST /balance-assertions/{id}/resolve
     → ResolveDiscrepancy
     → TransactionRecorded+Confirmed(ajuste: [Assets:X: -12.500, Equity:Adjustments: +12.500])
     → DiscrepancyResolved(assertion, adjustment_txn)
   → aserción cuadra; adjustment_audit acumula el indicador por cuenta
```

---

## 8. Riesgos y preguntas abiertas

### 8.1 Decisiones técnicas resueltas

| Decisión | Resolución | Justificación |
|---|---|---|
| Framework de event sourcing vs. implementación propia | **Implementación propia sobre PostgreSQL** (detrás del puerto `EventStore`, §3.8) | El dominio tiene políticas opinadas (idempotencia por `external_ref` en el stream, `INDETERMINATE`, reactors solo-commands) que chocarían con las convenciones de cualquier framework; la infraestructura requerida está completamente especificada y es acotada; una sola tecnología operativa (PostgreSQL) da transacción ACID entre eventos y proyecciones síncronas. Regla de disciplina: implementar solo la infraestructura que los requerimientos nombran, nada especulativo |
| Estrategia de proyección | **Híbrida con sesgo síncrono**: `transaction_list`, `proj_postings`, `account_balances`, `pending_review`, `ledger_settings` en la transacción del command; `assertion_status` y `adjustment_audit` asíncronas (poller propio con checkpoint / reactors) | El event store y las proyecciones en el mismo PostgreSQL hacen el modo síncrono gratis y correcto (ACID conjunto, RNF-9 trivial); las proyecciones derivadas y de reacción no tienen expectativa de inmediatez. El código del projector es idéntico en ambos modos (§3.8): mover una proyección de modo es configuración del adaptador, no reescritura |
| Malla de eventos / CDC (Debezium) | **Diferida a la aparición del primer consumidor externo real** (§9.3) | Debezium resuelve transporte/integración, no sourcing; su peso operativo (broker, conector, replication slots) no se justifica para projectors internos, que se sirven con el poller propio. El `event_store` ya es CDC-friendly por construcción (append-only, posición global, payload autocontenido): adoptarlo después no requiere ningún cambio del núcleo |
| Stack tecnológico | **NestJS (TypeScript) + PostgreSQL**, arquitectura hexagonal orientada a módulos: cada área del dominio (accounts, transactions, reconciliation, product, shared-kernel) como módulo NestJS con su hexágono interno (domain/application libres de NestJS; adaptadores en los providers del módulo) | El sistema de módulos e inyección de dependencias de NestJS materializa los puertos (§3.8) como tokens de inyección de forma natural. **Advertencia crítica del stack**: `number` de TypeScript es punto flotante y viola INV-8 — los montos viajan como strings decimales en DTOs, payloads de eventos y columnas `NUMERIC`, y se operan exclusivamente con una librería decimal dentro del value object `Money`, cuya construcción desde `number` está prohibida |

### 8.2 Preguntas abiertas

| # | Punto | Estado |
|---|---|---|
| 1 | Estrategia de migración de la base actual: generar el stream inicial (¿evento de importación por movimiento histórico vs. snapshot génesis?) | Pendiente de diseño; requiere inventario del esquema existente |
| 2 | Contrato OpenAPI detallado y su versionado inicial | Pendiente; insumo para el sistema de correos y el frontend |
| 3 | ¿Presupuesto consume transacciones `PENDING` o solo `CONFIRMED`? | **Ya no aplica a este servicio** (RF-24 fuera de alcance, §4.2). Se traslada al módulo de producto; `account_balances` ya distingue confirmados de pendientes, así que la información está disponible |
| 4 | Ventana temporal y tolerancia del detector de transferencias | **Cerrada por retiro (2026-07-25)**: RF-15 sale del alcance (§4.2). La fusión (RF-16) no usa ventana ni tolerancia — exige montos que neteen a **cero exacto**. Que la pregunta llevara meses sin resolverse fue parte del argumento para sacar la heurística del ledger |
| 5 | Contrato con el servicio de identidad: formato del contexto autenticado (headers firmados, JWT, mTLS interno) | Definir con ese servicio |
| 6 | Orden intradía cuando conviven transacciones con y sin `occurred_at` frente a aserciones intradía (regla `INDETERMINATE`, §2.4) | **Habilitada (2026-07-27)**: hasta entonces ninguna transacción podía portar un instante de negocio —el envelope grababa el momento del append— así que la pregunta era inalcanzable. Hoy `RecordTransaction` acepta `occurredAt` y llega hasta `proj_postings`. La regla conservadora vigente ya solo marca ambiguos los postings sin instante; queda validar contra datos reales de notificaciones si alcanza |
| 7 | ¿El renombre de cuenta propaga a descendientes en el mismo command o como eventos individuales por cuenta? | Decisión de diseño del agregado; afecta atomicidad del rebuild |
| 8 | Estrategia de respaldo y recuperación del event store (backups automatizados de PostgreSQL, prueba periódica de restauración) | **Pendiente durante el desarrollo; obligatoria antes de operar con datos financieros reales.** Nota simplificadora: solo el event store requiere respaldo — las proyecciones se reconstruyen por replay (RNF-5) |

---

## 9. Evolución futura del sistema

El diseño garantiza que las capacidades diferidas se agreguen de forma **aditiva**: nuevos tipos de evento, nuevas proyecciones, extensiones del balanceo — sin reescribir el stream ni romper el contrato del API.

### 9.1 Multi-moneda: ya presente en el núcleo

Capacidad estructural, no evolución pendiente: cada posting porta `(amount, currency)`, el balanceo es por moneda (INV-1) y existe `CurrencyRegistered` para el catálogo de monedas con sus `minor_units`. Habilitar una cuenta real en USD (Wise, cuenta en el exterior) no requiere cambios: se abre la cuenta con esa moneda y opera de inmediato. Lo que vive fuera de este servicio es la **valoración**: convertir saldos de varias monedas a una sola para consolidar requiere tasas (`PriceRecorded`, RF-22) y redondeo half-even de presentación (RF-23), y ambos pertenecen a la capa de producto (§4.2, principio de diseño #7). El ledger entrega los saldos exactos por moneda; consolidarlos es de quien reporta.

### 9.2 Inversiones con costo y lotes

Ruta de adopción del mecanismo `{cost}` de Beancount, natural en event sourcing:

1. **Extensión del payload (aditiva, versionada)**: nueva `schema_version` de los eventos de transacción cuyos postings admiten `cost_amount`, `cost_currency`, `lot_date`, `lot_label` opcionales. Los eventos históricos siguen siendo válidos vía upcasting (RNF-6). Nuevos commodities (acciones, cripto) se registran vía `CurrencyRegistered`.
2. **Extensión del balanceo (INV-11)**: los postings con costo balancean *al costo* (cantidad × costo unitario), no al valor nominal. Al residir la lógica en un único componente del dominio, la extensión es localizada y testeable de forma aislada.
3. **Cuentas y eventos de resultado**: `Income:CapitalGains` y eventos derivados de venta de lotes para ganancias/pérdidas realizadas.
4. **Nuevas proyecciones**: inventario de lotes por cuenta, ganancias realizadas/no realizadas. Se construyen con replay del stream completo, beneficio directo del event sourcing.
5. **Política de selección de lotes** (FIFO/específico) como servicio de dominio, sin impacto en el historial, junto con la **cuenta de residuos de redondeo** (`Equity:Rounding`, equivalente al `account_rounding` de Beancount) para balancear las migajas de cantidad × precio (§2.7.1).

El derivador de tipo ya está preparado: una compra de acciones (`Assets → Assets` con cambio de commodity) se clasifica `COMPOUND` sin fallar.

### 9.3 Otras extensiones previstas

- **Capa de producto** (presupuestos, metas, valoración, reportes consolidados, tasas de cambio, sugerencia de candidatos a transferencia): el consumidor previsto más inmediato de este API. Salió del alcance del servicio en la versión 0.8 (§4.2) y su diseño se conserva en §2.8, §2.9, §3.4 y RF-15/22/23/24/25. Se integra como cualquier otro cliente: contexto autenticado, `client_id` propio, lectura por queries y escritura por commands. Cero cambios en el núcleo.
- **Open Finance / APIs bancarias e importadores de formatos (OFX, CSV, camt.053)**: nuevos clientes del API con su propio `client_id`; cero cambios en el núcleo.
- **Transacciones periódicas / recurrentes** (equivalente a las periodic transactions de hledger): motor de plantillas que genera transacciones pendientes según calendario. Se implementa como módulo de producto o cliente automatizado; el payee de primera clase facilita la detección de recurrencias existentes.
- **Motor de sugerencia de categorías**: servicio o cliente que aprende de payee + historial y sugiere la contraparte al registrar pendientes. El ledger ya expone los datos necesarios.
- **Links entre transacciones** (equivalente a `^link` de Beancount): promoción de la convención de metadata a concepto de primera clase si los casos de uso (reembolsos, viajes) lo ameritan (§10).
- **Malla de eventos / eventos de integración vía CDC (Debezium)**: cuando exista el primer consumidor externo real (el sistema de correos reaccionando al ledger, notificaciones, analítica), la publicación se implementa con Change Data Capture sobre `event_store`: el append ACID es la única escritura y el CDC garantiza la publicación desde el WAL, eliminando el dual-write sin outbox adicional (la tabla de eventos ya es un outbox por construcción: append-only, posición global, payload autocontenido). Particionado por `user_id`, que preserva el orden total por usuario (INV-9). Se publica un **contrato público de eventos** (versión transformada), nunca el payload interno crudo, para no acoplar RNF-6 a consumidores externos. Es un adaptador de salida más (§3.7): cero cambios en el núcleo. Diferido deliberadamente hasta esa necesidad (§8.1) porque los projectors internos se sirven con el poller propio sin el costo operativo de broker + conector + replication slots.
- **Presupuestos multi-moneda / por moneda de la cuenta**: cambio confinado al módulo de producto y sus proyecciones.
- **Cuentas reales multi-moneda**: relajar la regla del agregado `Account` si algún día se necesita; los saldos ya son vectores por moneda.
- **Ledgers compartidos**: requiere evolucionar INV-9 hacia membresías; es la extensión más invasiva y se documenta como tal.

### 9.4 Reglas de protección (qué no hacer para no cerrar puertas)

1. Nunca colapsar `(amount, currency)` a un número asumiendo una moneda por defecto.
2. Mantener aritmética exacta en serialización y cálculo; prohibido float en payloads.
3. Mantener la lógica de balanceo en un solo componente del dominio (INV-11).
4. El derivador de tipo trata combinaciones desconocidas como `COMPOUND`, nunca como error.
5. No introducir en el ledger conocimiento de fuentes específicas (bancos, correos, formatos) ni de identidad de clientes; toda integración entra por el API con `client_id` opaco.
6. Nunca migrar eventos in situ: los cambios de esquema se resuelven con versionado y upcasting (RNF-6).
7. Los postings referencian cuentas por id, nunca por nombre: el renombre debe seguir siendo una operación barata.

---

## 10. Exclusiones conscientes de conceptos Beancount / hledger

Conceptos evaluados contra la referencia y descartados o diferidos deliberadamente, para que su ausencia no se interprete como omisión:

| Concepto (origen) | Decisión | Justificación |
|---|---|---|
| Flags por posting (`!`/`*` en asientos individuales, Beancount) | Excluido | El estado por transacción cubre el flujo de revisión; granularidad por posting no aporta al caso de uso |
| `pad` automático continuo | Adaptado | Se adopta como ajuste explícito y auditado (`ResolveDiscrepancy`), no como relleno automático silencioso: en una app con sync, un ajuste automático ocultaría fallas de captura |
| `note` / `document` sobre cuentas (Beancount) | Excluido v1 | Anotaciones fechadas a nivel cuenta sin caso de uso actual; los metadatos de cuenta cubren lo esencial |
| Links entre transacciones (`^link`) | Diferido | Vía metadata por convención en v1; promoción a primera clase según casos de uso reales (§9.3) |
| Tags (`#tag`) | Adoptado simplificado | Campo `tags` en la transacción, sin semántica de reporte especial en v1 |
| Transacciones periódicas (hledger `~`) | Diferido | Módulo de producto o cliente automatizado futuro (§9.3) |
| Presupuestos por transacción periódica (hledger `--budget`) | Adaptado | El modelo de presupuestos propio (§2.8) es más directo para una app interactiva |
| Aserciones con subcuentas (variantes hledger `=*`) | Excluido v1 | La aserción sobre cuenta exacta es la correcta para conciliación bancaria con espejo 1:1 |
| Tolerancias inferidas de balanceo (`inferred_tolerance_default`, `tolerance_multiplier`, Beancount) | Adaptado a la inversa | Beancount tolera imprecisión porque su input es texto humano heterogéneo; este sistema recibe datos bancarios exactos, por lo que impone estrictez: `Money` respeta los `minor_units` de su moneda y el balanceo es exacto sin tolerancia (§2.7.1, INV-8) |
| Cuenta de residuos de redondeo (`account_rounding`, Beancount) | Diferido | Sin costos/lotes no existen residuos dentro de transacciones (los registros bancarios son exactos y la valoración redondea solo en lectura); se adopta junto con §9.2 cuando cantidad × precio genere migajas que deban balancearse |
| Costo y lotes (`{cost}`, Beancount) | Diferido | Ruta de adopción completa documentada en §9.2 |
| `event` (directiva genérica de Beancount) | Excluido | Sin caso de uso; el event stream propio ya registra hechos fechados |
| Archivo de texto como interfaz de edición | Excluido por naturaleza | El API y el event stream reemplazan la edición de texto; las operaciones que Beancount resuelve editando (renombrar, corregir, revocar) se modelan como commands explícitos |

---

## 11. Fases sugeridas de implementación

1. **Fase 1 — Núcleo de dominio, puertos y adaptadores base**: value objects (`Money`, `AccountName`, `Payee`), agregados `Account` y `LedgerTransaction` con sus invariantes (incl. anotación vs. enmienda), puertos del núcleo (§3.8) con adaptadores in-memory y contract tests, adaptador `PostgresEventStore` (append-only, concurrencia optimista, idempotencia), command bus con sus políticas transversales, projectors con despacho síncrono y poller con checkpoints, tooling de rebuild, inicialización del ledger con cuentas técnicas, proyecciones `account_tree`, `transaction_list`, `account_balances`. Migración de datos existentes como generación del stream inicial.
2. **Fase 2 — API**: contrato OpenAPI, integración del contexto autenticado externo, endpoints despachando a command bus y query bus, códigos de error de dominio, lectura de escrituras propias.
3. **Fase 3 — Conciliación y transferencias**: agregado `BalanceAssertion` con evaluación, revocación y resolución de discrepancias; primeros reactors (re-evaluación de aserciones); proyecciones de conciliación y auditoría de ajustes; fusión de transferencias.
4. **Fase 4 — Configuración y monedas**: `LedgerSettings` (moneda de presentación y zona horaria) y catálogo de monedas administrable. Ambos son parámetros que el núcleo necesita, no capa de producto.

La fase 4 de la versión 0.7 («Producto»: presupuestos, metas, tasas, valoración y reportes)
salió del alcance de este servicio en la 0.8 (§4.2) y pasa a ser un componente aparte,
construido sobre este API. Cada fase deja el sistema en estado consistente y usable por
clientes API.

**Operabilidad** (backups y prueba de restauración, runbook de rebuild, métricas OTel de
RNF-12) no es una fase: son tareas de infraestructura sin dependencia de orden, que se
construyen en paralelo desde la fase 2 y deben estar completas antes de operar con datos
reales.
