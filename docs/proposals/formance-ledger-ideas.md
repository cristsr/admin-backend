# Ideas del core de Formance Ledger aplicables a `apps/ledger`

**Versión:** 1.0
**Fecha:** 2026-08-08
**Estado:** Propuesta — insumo de diseño, ninguna decisión tomada
**Fuente analizada:** [`formancehq/ledger`](https://github.com/formancehq/ledger), rama `main`
(paquetes `internal/`, `internal/controller/ledger/`, `internal/api/v2/`, `pkg/features/`)

---

## 1. Propósito y método

Este documento extrae del **núcleo** del ledger de Formance las ideas de diseño que
aportarían algo real a `apps/ledger`, y descarta explícitamente las que no. No es un plan de
implementación: es un catálogo de hallazgos evaluados contra
[`ledger-spec.md`](../ledger-spec.md) y contra el código ya construido (EP-0 a EP-4 cerradas).

**Método.** Se leyó el código del core, no la documentación de producto: los tipos de dominio
(`internal/*.go`), el controlador de escritura (`internal/controller/ledger/`), la superficie
HTTP (`internal/api/v2/routes.go`) y el catálogo de capacidades (`pkg/features/features.go`).
Cada hallazgo cita el archivo y las líneas donde vive la idea, para que sea verificable.

**Criterio de inclusión.** Entra al catálogo lo que resuelve un problema que nuestra spec ya
reconoce (una pregunta abierta, un RNF sin mecanismo, una proyección costosa) o lo que cubre
un hueco que la spec no vio. Se descarta lo que resuelve un problema que no tenemos.

**Veredictos usados:**

| Veredicto | Significado |
|---|---|
| **Adoptar** | La idea aplica casi tal cual; el costo es bajo y el beneficio es directo |
| **Adaptar** | La idea es buena pero su forma en Formance choca con nuestros invariantes; se toma el concepto, no la implementación |
| **Diferir** | Idea válida cuyo disparador todavía no existe en este proyecto |
| **Descartar** | Resuelve un problema que no tenemos, o contradice un invariante que no queremos relajar |

---

## 2. Calibración: qué tan comparables son los dos sistemas

Antes de trasplantar nada conviene saber qué es Formance y qué no. Es un **core ledger de
dinero programable multi-tenant** para plataformas de pagos, no un libro contable personal.
Las diferencias de paradigma determinan qué es trasplantable.

| Dimensión | Formance | `apps/ledger` | Consecuencia |
|---|---|---|---|
| Unidad de aislamiento | N ledgers por instancia, agrupados en *buckets* (esquemas Postgres) | Un ledger por `user_id` (INV-9) | Su gestión de ledgers/buckets no aplica |
| Modelo de posting | Unidireccional: `source → destination`, `amount` siempre positivo | Bidireccional: `(account_id, amount con signo)` (§2.3) | Su modelo hace los volúmenes triviales; el nuestro los hace derivables. No hay que cambiar de modelo para ganar volúmenes |
| Plan de cuentas | Direcciones libres, cuentas creadas al primer uso | Cuentas abiertas explícitamente, 5 tipos raíz, INV-3/INV-13/INV-14 | Nuestro dominio es **más estricto**; no relajarlo |
| Ciclo de vida de la transacción | Inmediata e inmutable; solo `revert` | `PENDING → CONFIRMED → VOIDED/REVERSED` + enmienda y anotación (§2.2, INV-6) | Nuestro dominio es **más rico**; Formance no tiene nada que aportar aquí |
| Conciliación | No existe | Aserciones de saldo con semántica temporal (§2.4) | Ídem |
| Programabilidad | **Numscript**, DSL con allocations y overdraft | Postings explícitos desde el cliente | El DSL no aplica (§6 de este doc); las *plantillas* sí |
| Fuente de verdad | Log append-only con **cadena de hashes** | `event_store` append-only con trigger | Su cadena de hash es defensa en profundidad que no tenemos |
| Escala | Cuentas con millones de movimientos | Finanzas personales | Sus optimizaciones de volumen son mayormente innecesarias… salvo la de §3.2, que aquí gana por corrección, no por rendimiento |

**Conclusión de la calibración.** Formance no tiene nada que enseñarnos sobre *contabilidad*
—nuestro modelo es más rico— pero sí bastante sobre **integridad verificable, protocolo de
escritura y consistencia de lectura**, que es donde su producción a escala los obligó a
resolver problemas que nosotros todavía no hemos encontrado.

---

## 3. Bloque A — Modelo de saldos y tiempo contable

### F-1 · Volúmenes `(input, output)` en vez de un saldo escalar — **Adoptar**

**Qué hace Formance.** Nunca almacena un saldo. Almacena por cuenta y activo un par
`Volumes{Input, Output}` de enteros grandes, y define `Balance() = Input − Output`.

```go
// internal/volumes.go:13-16, 86-88
type Volumes struct {
    Input  *big.Int `json:"input"`
    Output *big.Int `json:"output"`
}
func (v Volumes) Balance() *big.Int { return new(big.Int).Sub(v.Input, v.Output) }
```

La serialización expone los tres campos (`input`, `output`, `balance`), así que el cliente
recibe el saldo sin poder confundirlo con un dato almacenado (`internal/volumes.go:78-84`).

**Qué ganamos.** Nuestra `proj_balances` guarda `confirmed_amount` / `pending_amount`
(§6.2): dos escalares que responden *"cuánto hay"* pero no *"cuánto entró y cuánto salió"*.
Con volúmenes obtenemos gratis, y sin tocar el stream:

- **Flujo por cuenta y período** sin recorrer `proj_postings`: cuánto se gastó en
  `Expenses:Food` es `output`, no una agregación.
- **Verificación de consistencia más fuerte** (RNF-5, y la tarea abierta de Operabilidad):
  hoy `ConsistencyVerifier` compara un escalar; con volúmenes compara dos magnitudes
  independientes, y un error de signo en un proyector deja de ser invisible.
- Una base natural para el reporte de gasto por categoría que vive en la capa de producto
  (§4.2): el ledger entrega el insumo exacto sin volverse un motor de reportes.

**Adaptación.** No hay que adoptar el posting unidireccional de Formance. Con montos con
signo, el proyector acumula `input += max(amount, 0)` y `output += max(−amount, 0)`. El
cambio se confina a `proj_balances` y su proyector; ninguna otra tabla lo nota.

**Costo.** Bajo: dos columnas más por fila de `proj_balances` × (confirmed, pending), el
proyector, y un rebuild. Sin migración de datos (fase de desarrollo, sin producción).

**Riesgo.** Ninguno estructural. El único cuidado es que `balance` siga siendo un **derivado
calculado**, nunca una tercera columna persistida — persistirla reintroduce el estado
inconsistente que INV-5 quiere evitar.

---

### F-2 · Post-commit volumes: el saldo resultante grabado en cada transacción — **Adaptar** ⭐

**Qué hace Formance.** Cada transacción persiste el saldo de cada cuenta/activo involucrado
**después** de aplicarse, en dos variantes:

```go
// internal/transaction.go:46-51
// PostCommitVolumes are the volumes of each account/asset after a transaction has been committed.
// Those volumes will never change as those are computed in flight.
PostCommitVolumes PostCommitVolumes
// PostCommitEffectiveVolumes are the volumes of each account/asset after the transaction
// TransactionData.Timestamp. Those volumes are also computed in flight, but can be updated
// if a transaction is inserted in the past.
PostCommitEffectiveVolumes PostCommitVolumes
```

Y los `preCommitVolumes` se derivan restando los postings al serializar
(`internal/transaction.go:190-205`), sin almacenarlos.

La distinción es la clave: **post-commit** sigue el orden de *inserción* (nunca cambia);
**post-commit effective** sigue el orden de *fecha contable* (se recalcula si llega una
transacción con fecha anterior).

**Por qué es el hallazgo más valioso del análisis.** Resuelve tres cosas nuestras a la vez:

1. **Evaluación de aserciones en O(1) en vez de O(n).** Hoy, evaluar una `BalanceAssertion`
   (§2.4, EP-3.2) exige sumar todos los postings de la cuenta anteriores a la fecha. Con
   effective volumes, la respuesta es el volumen efectivo del último movimiento anterior al
   corte: una lectura, no una agregación. Y la re-evaluación (RF-18) deja de ser un recálculo
   completo.
2. **Cierra la pregunta abierta #6** (§8.2, orden intradía con y sin `occurred_at`). El
   problema no era la regla `INDETERMINATE`, era que no había forma barata de saber *qué
   saldo había en un instante*. Con effective volumes, el instante es consultable.
3. **Da el "saldo corrido" del extracto bancario** —la columna que todo usuario espera ver
   junto a cada movimiento— sin que el frontend acumule nada.

**Adaptación necesaria.** Aquí hay que tener cuidado, porque nuestro dominio tiene un estado
que Formance no tiene: `PENDING`. Un post-commit volume solo tiene sentido sobre la población
que el saldo refleja. Propuesta: calcular effective volumes **únicamente sobre transacciones
`CONFIRMED`**, y mantener el saldo pendiente como el escalar actual. Una transacción
`PENDING` no fija saldo histórico porque todavía puede ser enmendada (RF-6).

Segundo cuidado: esto vive **en la proyección**, no en el evento. Formance lo persiste en la
transacción porque su log *es* su modelo de lectura; nosotros tenemos event store separado y
grabar un derivado en el payload violaría INV-5 y el principio #2. Va en `proj_postings` (o
en una tabla de *moves*, ver F-3), y se reconstruye por replay como todo lo demás.

**Costo.** Medio-alto. Es el hallazgo más caro del catálogo: exige que el proyector, ante una
transacción con fecha anterior a otras ya proyectadas, **recalcule hacia adelante** los
volúmenes efectivos de esa cuenta. Formance lo trata como una capacidad opcional justamente
por eso (ver F-20).

**Riesgo.** El recálculo hacia adelante es la parte delicada; debe ser idempotente y correr
dentro de la misma transacción del proyector. Recomendación: implementarlo detrás de una
bandera y validar contra `ConsistencyVerifier` antes de que ninguna query dependa de él.

---

### F-3 · *Moves*: una fila por cuenta afectada, con doble fecha — **Adaptar**

**Qué hace Formance.** Descompone cada posting en dos filas (una por lado) en una tabla
`moves`:

```go
// internal/moves.go:13-25
type Move struct {
    TransactionID              uint64
    IsSource                   bool
    Account                    string
    Amount                     *paginate.BigInt
    Asset                      string
    InsertionDate              time.Time
    EffectiveDate              time.Time
    PostCommitVolumes          *Volumes
    PostCommitEffectiveVolumes *Volumes
}
```

`ComputePostCommitEffectiveVolumes` recorre los moves del más reciente al más antiguo y se
queda con el primero de cada `(cuenta, activo)` (`internal/moves.go:29-61`).

**Qué ganamos.** Nuestra `proj_postings` ya es casi esto: tiene `account_id`, `amount`,
`currency_code`, `date` y `status`. Lo que falta son dos cosas concretas:

- **Las dos fechas separadas en la misma fila**: `effective_date` (nuestra `date` contable) e
  `insertion_date` (cuándo se proyectó). Hoy `proj_postings` solo lleva `date`, así que no se
  puede reconstruir "qué sabíamos el martes" ni ordenar de forma estable dos movimientos con
  la misma fecha contable.
- El anclaje de F-2: los volúmenes van en la fila del move, que es la granularidad correcta.

**Adaptación.** No hace falta la duplicación por lado: con montos con signo, una fila por
posting ya identifica la cuenta. Es agregar dos columnas a `proj_postings`, no una tabla
nueva.

**Costo.** Bajo si se hace junto con F-1/F-2; es prerrequisito natural de F-2.

---

### F-4 · Fecha efectiva vs. fecha de inserción como concepto explícito del contrato — **Adoptar**

**Qué hace Formance.** La transacción tiene `Timestamp` (fecha del hecho, elegible por el
cliente) e `InsertedAt` (cuándo entró al sistema), y todo el modelo de consulta puede ordenar
y filtrar por cualquiera de las dos (`internal/transaction.go:42-45`). Insertar en el pasado
es una operación de primera clase, no una anomalía.

**Qué ganamos.** Nuestra spec ya distingue `date` (contable), `occurred_at` (instante de
negocio) y `recorded_at` (append) —§3.4, RNF-7—, así que el concepto está. Lo que no está es
la **consecuencia**: qué pasa cuando llega una transacción fechada antes que otras ya
registradas. Hoy la respuesta implícita es "las proyecciones la suman y ya", lo cual es
correcto para el saldo actual pero deja inconsistente cualquier saldo histórico y obliga a la
re-evaluación de aserciones a recalcular a ciegas (RF-18).

**Adaptación.** No es código nuevo: es **cerrar la semántica en la spec**. Declarar
explícitamente que el back-dating es soportado, que dispara recálculo de volúmenes efectivos
(F-2) y re-evaluación de aserciones posteriores, y que el orden de desempate dentro del mismo
día es `occurred_at` y luego posición global del stream.

**Costo.** Documental, más lo que ya cueste F-2.

---

## 4. Bloque B — Integridad verificable y auditoría

### F-5 · Cadena de hashes sobre el log — **Adoptar** ⭐

**Qué hace Formance.** Cada entrada del log encadena su hash con el de la anterior:

```go
// internal/log.go:115-124, 146-183
func (l Log) ChainLog(previous *Log) Log {
    ret := l
    ret.ComputeHash(previous)
    ...
}
func (l *Log) ComputeHash(previous *Log) {
    digest := sha256.New()
    enc := json.NewEncoder(digest)
    if previous != nil { enc.Encode(previous.Hash) }
    ...
    // notes(gfyrag): Keep keys ordered! the order matter when hashing the log.
}
```

Al importar un log exportado, se recomputa la cadena y se rechaza el import si un hash no
cuadra, señalando el `logID` exacto (`internal/controller/ledger/errors.go:56-81`,
`ErrInvalidHash`).

**Qué ganamos.** Nuestra defensa de inmutabilidad (INV-12) es un trigger de PostgreSQL
(§6.1). Es buena defensa en profundidad contra un bug de la aplicación, pero **no protege
contra nadie que tenga permisos sobre la base**: un `ALTER TABLE ... DISABLE TRIGGER`, una
restauración de backup manipulada o un `UPDATE` directo pasan sin dejar rastro. Una cadena de
hashes convierte "confío en que nadie tocó la tabla" en **"cualquier alteración es
detectable"**, que es lo que RNF-3 (auditabilidad) realmente promete.

Beneficio secundario y concreto: hace verificable el import de F-7 y la restauración de
backups —hoy la única verificación post-restore que tenemos es `rebuildAll` +
`verify-balances`, que detecta corrupción pero no manipulación.

**Adaptación.** Nuestro equivalente del log es `event_store`, y ya tiene `global_position`
como orden total. La columna `hash BYTEA` se calcula sobre `(hash_anterior, envelope
canónico, payload canónico)` dentro del mismo append atómico (INV-7). Dos requisitos no
negociables:

1. **Serialización canónica determinista.** El comentario `Keep keys ordered!` del código de
   Formance no es un detalle de estilo: si el orden de claves del JSON varía, el hash varía y
   la cadena entera deja de verificar. En TypeScript hay que serializar con claves ordenadas
   explícitamente, nunca con `JSON.stringify` sobre un objeto de forma libre.
2. **Contención de escritura.** Encadenar exige leer el hash anterior, lo que serializa los
   appends. Formance lo resuelve con un lock a nivel de ledger; nosotros podemos encadenar
   **por usuario** (coherente con INV-9 y con el particionado previsto en §9.3), lo que hace
   la contención irrelevante en finanzas personales.

**Costo.** Bajo-medio: una columna, una función de canonicalización bien testeada, y un
comando de verificación (`verify-chain`) en el tooling que ya existe.

---

### F-6 · *Memento*: excluir los derivados del hash — **Adoptar** (junto con F-5)

**Qué hace Formance.** Al hashear, no usa el payload completo sino una proyección reducida:

```go
// internal/log.go:237-262
func (p CreatedTransaction) GetMemento() any {
    // Exclude postCommitVolumes and postCommitEffectiveVolumes fields from transactions.
    // We don't want those fields to be part of the hash as they are not part of the
    // decision-making process.
```

**Qué ganamos.** Es la regla de diseño que hace sostenible F-5: **al hash solo entra lo que
fue una decisión**, nunca lo que es consecuencia calculable de ella. Si un derivado entra al
hash, cualquier cambio futuro en cómo se calcula (un bug corregido en el proyector, un
redondeo distinto) invalida retroactivamente toda la cadena histórica.

Para nosotros la regla se traduce directo: al hash entran postings, montos, monedas, fecha
contable, `occurred_at`, `client_id` y `external_ref`; **no** entra nada derivado ni ningún
timestamp asignado por la infraestructura después del hecho.

**Costo.** Nulo — es una decisión de diseño, no código adicional.

---

### F-7 · Export / import del log completo — **Diferir**

**Qué hace Formance.** Expone `POST /{ledger}/logs/export` y `POST /{ledger}/logs/import`
(`internal/api/v2/routes.go:104-108`). El import exige que el ledger esté en estado
`initializing` y valida la cadena de hashes entrada por entrada
(`internal/controller/ledger/controller.go:76-82`, `ErrImport`).

**Qué ganamos.** Backup lógico independiente del motor, clonar un ledger a un entorno de
pruebas con datos reales, y fixtures reproducibles para tests de integración. Nuestro §8.2
cerró la pregunta #8 con "un dump de Postgres alcanza", lo cual es cierto para *recuperación*
pero no cubre portabilidad ni el escenario de migrar de motor que §3.8 reconoce como "un
proyecto de ETL independiente".

**Por qué diferir.** El disparador no existe: no hay despliegue, no hay segundo entorno y no
hay volumen de datos que haga doloroso reconstruir. Además el valor del import depende de
F-5: sin cadena de hashes, un import es solo un `INSERT` masivo sin garantías.

**Condición de disparo.** Que exista un segundo entorno (staging) o el primer consumidor
externo real.

---

### F-8 · *Chart of accounts* declarativo y versionado — **Adaptar** ⭐

**Qué hace Formance.** Es la incorporación más reciente y ambiciosa de su core: un **plan de
cuentas declarativo en JSON**, insertado como una entrada del log
(`InsertedSchemaLogType`, `internal/log.go:25`), versionado, y contra el cual se valida cada
posting antes de escribir.

La estructura combina segmentos fijos y variables, con propiedades marcadas por prefijo `.`:

```go
// internal/chart.go:36-40
const PROPERTY_PREFIX = "."
const PATTERN_KEY    = ".pattern"   // regex que el segmento variable debe cumplir
const SELF_KEY       = ".self"      // este nodo es una cuenta, no solo un contenedor
const RULES_KEY      = ".rules"
const METADATA_KEY   = ".metadata"  // metadata por defecto de las cuentas del nodo
```

Un segmento que empieza con `$` es variable (`$userId`) y puede llevar `.pattern`; los demás
son fijos. La resolución recorre la dirección segmento a segmento
(`internal/chart.go:251-304`) y la validación se aplica a source y destination de cada
posting (`internal/chart.go:306-316`). Los errores son específicos y accionables:

```go
// internal/errors.go:113-125
"account `%v` is not defined in the chart of accounts"
"segment `%v` defined by the chart of accounts at `%v` does not match the pattern"
"segment `%v` is not allowed by the chart of accounts at `%v`"
```

Además, cada cuenta del chart puede declarar **metadata por defecto**, que se aplica al crear
la cuenta (`internal/chart.go:318-326`, `internal/transaction.go:240-269`).

**Qué ganamos.** Nuestra jerarquía por nombre (§2.1) es hoy una **convención**: `AccountName`
valida los 5 tipos raíz y la forma del nombre, pero nada impide abrir
`Expenses:Comida:Restaurantes` junto a `Expenses:Food:Restaurants`, ni
`Assets:Bancolombia:Ahorro` junto a `Assets:Bancolombia:Ahorros`. En un ledger personal
alimentado por automatizadores, esa deriva de nombres es **la** forma en que los datos se
degradan con el tiempo — y es exactamente el tipo de error que las proyecciones no detectan
porque no es una inconsistencia, es un plan de cuentas sucio.

Un chart declarativo convierte la convención en invariante verificable, y hace que la
sugerencia de categorías (§4.2, fuera de alcance) tenga un vocabulario cerrado contra el cual
sugerir.

**Adaptación.** Aquí hay que tomar el concepto y dejar buena parte de la implementación:

- **Los segmentos variables con regex sí aplican**, y bien: `Assets:$bank:$product` con
  `.pattern` sobre el nombre del banco es exactamente nuestra estructura.
- **La validación va en el agregado `Account`, no en el posting.** Formance valida postings
  porque sus cuentas nacen implícitas; nosotros abrimos cuentas explícitamente (INV-3), así
  que el punto de control natural es `OpenAccount` y `RenameAccount`. Validar postings sería
  redundante.
- **El chart entra al stream como evento** (`ChartOfAccountsDefined`), versionado, coherente
  con el principio #2. Cada evento de cuenta registra contra qué versión se validó — el mismo
  patrón de `SchemaVersion` en el log de Formance (`internal/log.go:101`).
- **La metadata por defecto por nodo** es un extra elegante: "toda cuenta bajo `Assets:*` es
  espejo bancario" deja de ser un flag que el cliente manda en cada apertura.

**Costo.** Medio. Es funcionalidad nueva (un agregado o entidad de referencia más un
validador recursivo), pero completamente aditiva y sin tocar nada existente.

**Riesgo.** El principal es de producto, no técnico: un chart demasiado rígido convierte
"abrir una cuenta nueva" en "editar el chart primero". Mitigación en F-9.

---

### F-9 · Modo de aplicación del schema: estricto vs. permisivo — **Adoptar** (junto con F-8)

**Qué hace Formance.** La validación contra el schema tiene dos modos. En estricto, la
violación aborta la operación; en permisivo, la registra como atributo de traza y log de
error, y deja pasar la escritura:

```go
// internal/controller/ledger/log_process.go:117-126
if err := log.ValidateWithSchema(*schema); err != nil {
    err := newErrSchemaValidationError(parameters.SchemaVersion, err)
    if lp.schemaEnforcementMode == SchemaEnforcementStrict {
        return nil, nil, err
    } else {
        trace.SpanFromContext(ctx).SetAttributes(...)
        logging.FromContext(ctx).Errorf("schema validation failed: %s", err)
    }
}
```

**Qué ganamos.** Es el patrón de rollout que hace segura cualquier validación nueva sobre un
sistema con clientes ya escribiendo: se despliega en permisivo, se observa cuántas
violaciones reales aparecen, se limpian, y recién entonces se activa estricto. Sin él, F-8 es
un cambio incompatible el día uno.

Aplicable más allá del chart: es la forma correcta de introducir **cualquier** invariante
nuevo sobre datos existentes.

**Costo.** Trivial — un parámetro de configuración y una rama.

---

## 5. Bloque C — Protocolo de escritura

### F-10 · *Idempotency hash*: detectar reuso de clave con inputs distintos — **Adoptar** ⭐

**Qué hace Formance.** Además de la clave de idempotencia, guarda el hash de los inputs
originales:

```go
// internal/log.go:95-99
IdempotencyKey string
// IdempotencyHash is a signature used when using IdempotencyKey.
// It allows checking if the usage of IdempotencyKey matches inputs given on the first
// idempotency key usage.
IdempotencyHash string
```

Al recibir una clave ya vista, recomputa el hash de los inputs entrantes y compara. Si no
coincide, **falla en vez de devolver el resultado viejo**:

```go
// internal/controller/ledger/log_process.go:230-236
if len(log.IdempotencyHash) > 0 {
    if computedHash := ledger.ComputeIdempotencyHash(parameters.Input);
       log.IdempotencyHash != computedHash {
        return nil, nil, newErrInvalidIdempotencyInputs(...)
    }
}
```

**Qué ganamos.** Es un hueco real de nuestro diseño. Nuestra idempotencia (INV-10, EP-1.3,
*anchor-only stamping*) hace short-circuit por `external_ref`: si el sistema de correos
reutiliza una referencia por un bug de parseo y manda **datos distintos**, hoy le devolvemos
silenciosamente el resultado de la operación anterior y la transacción nueva se pierde sin
error, sin log y sin síntoma. Con el hash, ese caso se convierte en un error explícito y
accionable.

En un ledger alimentado por automatizadores, este es exactamente el tipo de fallo silencioso
que RNF-3 debería impedir y hoy no impide.

**Adaptación.** Directa: columna `external_ref_hash` en `event_store`, poblada en el mismo
append, y verificación en el short-circuit del command bus. Un código de error nuevo:
`IDEMPOTENCY_INPUT_MISMATCH` (409), junto a `DUPLICATE_EXTERNAL_REF` que ya tenemos (RF-14).

**Costo.** Bajo. Una columna, una función de hash canónico (compartida con F-5), una rama en
el short-circuit.

**Detalle adicional que vale la pena copiar.** Cuando la respuesta viene de un acierto de
idempotencia, Formance lo señala en la respuesta HTTP:

```go
// internal/api/v2/controllers_transactions_create.go:72-74
if idempotencyHit { w.Header().Set("Idempotency-Hit", "true") }
```

Costo nulo, y le dice al cliente que su reintento fue reintento —información que hoy no
tiene forma de obtener.

---

### F-11 · Separar *reference* de negocio e *idempotency key* de protocolo — **Adaptar**

**Qué hace Formance.** Son dos cosas distintas con dos errores distintos. La `Reference` es
un campo de la transacción con constraint de unicidad
(`internal/transaction.go:24`), y su colisión devuelve
`ErrTransactionReferenceConflict` → HTTP 409 (`internal/controller/ledger/errors.go:129-146`,
`controllers_transactions_create.go:61-62`). La `IdempotencyKey` es un parámetro de la
operación, no del dominio (`internal/controller/ledger/parameters.go:3-8`), y su conflicto es
`ErrIdempotencyKeyConflict`.

**Qué ganamos.** Nuestro `external_ref` colapsa dos responsabilidades (§2.11): identificar el
hecho externo *y* proteger el reintento. Funcionan juntas mientras el cliente sea uno solo,
pero se separan en cuanto aparece un caso legítimo:

- Un mismo hecho bancario capturado por **dos clientes distintos** (el frontend y el
  automatizador de correos) debería colisionar por *reference* — es un duplicado de negocio,
  y el cliente merece un 409 explicativo, no un resultado ajeno devuelto como propio.
- Un mismo cliente reintentando por timeout debería resolverse por *idempotency key* — es el
  mismo comando, no un duplicado.

Con un solo campo, el segundo caso enmascara el primero.

**Adaptación.** No es urgente y es un cambio de contrato (RNF-8). Propuesta mínima: mantener
`external_ref` como está y **documentar en la spec cuál de las dos semánticas tiene**, para
después introducir la otra como campo nuevo cuando aparezca el segundo cliente escritor. F-10
mitiga entretanto el fallo más peligroso.

**Costo.** Medio, y sobre todo de contrato. Diferible sin deuda si se documenta la decisión.

---

### F-12 · *Dry run*: ejecutar el comando completo y hacer rollback — **Adoptar**

**Qué hace Formance.** `DryRun` es un parámetro de toda operación de escritura
(`internal/controller/ledger/parameters.go:3-8`). La implementación es elegantemente simple:
ejecuta **todo** —validaciones, cálculo de volúmenes, inserción del log— dentro de la
transacción, y en vez de commitear, hace rollback devolviendo el resultado:

```go
// internal/controller/ledger/log_process.go:53-58
if parameters.DryRun {
    if rollbackErr := store.Rollback(ctx); rollbackErr != nil { ... }
    return log, output, nil
}
```

**Qué ganamos.** Un preview que **no puede divergir** de la ejecución real, porque es la
ejecución real. Casos concretos en nuestro dominio:

- Previsualizar el saldo resultante antes de confirmar una `PENDING` (RF-6): el usuario ve
  qué le queda en la cuenta antes de decidir.
- Validar un lote del automatizador de correos antes de registrarlo.
- Verificar que una `MergePendingTransfers` (RF-16) va a pasar todas sus validaciones sin
  arriesgar la anulación de las dos pendientes.

La alternativa —un endpoint de validación que reimplementa las reglas— es exactamente la
duplicación que garantiza divergencia.

**Adaptación.** Encaja con nuestra arquitectura: el command bus ya ejecuta dentro de una
transacción con las proyecciones síncronas (§8.1). El parámetro entra en el envelope del
comando, y en modo dry-run el resultado se devuelve pero **no se emite ningún evento**. Un
cuidado explícito: los reactors (§3.2) no deben despacharse en dry-run, y un `IdGenerator`
determinista evita quemar ids.

**Costo.** Bajo, si el command bus ya controla la frontera transaccional.

---

### F-13 · Revert con fecha efectiva elegible — **Adaptar** (parcialmente ya resuelto)

**Qué hace Formance.** El revert tiene tres decisiones explícitas en su contrato:

```go
// internal/controller/ledger/controller.go:56-60, 104-109
// Parameter force indicate we want to force revert the transaction even if the accounts
// does not have funds
// Parameter atEffectiveDate indicate we want to set the timestamp of the newly created
// transaction on the timestamp of the reverted transaction
type RevertTransaction struct {
    Force           bool
    AtEffectiveDate bool
    TransactionID   uint64
    Metadata        metadata.Metadata
}
```

Y revertir dos veces es un error tipado, no una segunda reversa
(`internal/controller/ledger/errors.go:89-108`, `ErrAlreadyReverted`). La transacción
original queda marcada con `RevertedAt`, y `reverted: bool` se deriva al serializar
(`internal/transaction.go:207-209`).

**Qué ya tenemos.** Conviene ser preciso, porque dos de las tres ideas ya están resueltas en
el código:

- La **doble reversa ya se impide**: `ledger-transaction.aggregate.ts:174-176` mantiene un
  flag `reversed` y lanza `InvalidTransactionStateException('Transaction is already
  reversed')`. Lo único mejorable es que el error es genérico, no un código estable de RF-14.
- La reversa **ya nace con la fecha de la original**:
  `reverse-confirmed-transaction.handler.ts:51` copia `date: original.date`. Es decir, ya
  aplicamos de facto `atEffectiveDate: true`, que es el default contablemente correcto.

**Qué ganamos igual.** Dos cosas menores pero reales:

1. **Hacer la fecha elegible, no fija.** Nuestro comportamiento actual corrige el saldo
   histórico, y las aserciones posteriores se re-evalúan (RF-18) como corresponde. Pero
   existe un caso legítimo para lo contrario: una transacción de un período ya conciliado y
   cerrado, donde asentar la corrección **hoy** —y dejar el histórico intacto— es la práctica
   contable habitual. Formance lo trata como elección explícita del cliente; nosotros lo
   tenemos como decisión implícita del handler, ni siquiera documentada en §7.3.
2. **Elevar el error a código estable.** `TRANSACTION_ALREADY_REVERSED` en RF-14, para que el
   cliente distinguía "ya la revertí" de cualquier otro estado inválido.

`Force` no aplica: es específico de su regla de fondos insuficientes, que nosotros no
tenemos (ver §8).

**Adaptación.** `ReverseConfirmedTransaction` acepta `atEffectiveDate: boolean` con default
`true` (el comportamiento actual, sin romper nada); §7.3 documenta la elección y su efecto
sobre las aserciones.

**Costo.** Bajo, y es sobre todo documentar una decisión que hoy solo vive en el código.

---

### F-14 · Reintento automático ante deadlock y conflicto de clave — **Adaptar**

**Qué hace Formance.** El conflicto de escritura no se propaga al cliente: se reintenta en
bucle, contabilizando cada ocurrencia como métrica:

```go
// internal/controller/ledger/log_process.go:190-211
for {
    log, output, err := lp.runTx(ctx, store, parameters, fn)
    if err != nil {
        switch {
        case errors.Is(err, postgres.ErrDeadlockDetected):
            trace.SpanFromContext(ctx).SetAttributes(attribute.Bool("deadlock", true))
            lp.deadLockCounter.Add(ctx, 1, metric.WithAttributes(...))
            continue
        // A log with the IK could have been inserted in the meantime, read again the
        // database to retrieve it
        case errors.Is(err, ledgerstore.ErrIdempotencyKeyConflict{}):
            ...
        }
    }
}
```

**Qué ganamos.** Nuestro contrato hoy expone `CONCURRENCY_CONFLICT` al cliente (RF-14) y le
delega el reintento. Para un conflicto de concurrencia optimista real —dos comandos sobre el
mismo agregado— eso es correcto: el segundo debe recargar y revalidar, porque su decisión se
tomó sobre un estado viejo. Pero para un **deadlock de PostgreSQL** no lo es: el comando era
válido, solo perdió una carrera de locks, y hacer que el automatizador de correos reintente
por HTTP lo que el servidor puede reintentar en microsegundos es regalar fallos.

La segunda mitad —ante colisión de clave, releer en vez de fallar— cierra la carrera de dos
reintentos simultáneos con la misma `external_ref`, que hoy probablemente devuelve
`DUPLICATE_EXTERNAL_REF` a uno de los dos en vez del resultado compartido.

**Adaptación.** Un decorador de reintento en el command bus, con límite de intentos y
backoff, que distingue las dos causas:

- deadlock / error transitorio del motor → reintentar (con tope);
- conflicto de concurrencia optimista del agregado → **no** reintentar ciegamente, propagar;
- colisión de `external_ref` → releer y devolver el resultado original (F-10 valida que los
  inputs coincidan).

La métrica de deadlocks se suma a las tres que RNF-12 ya nombra.

**Costo.** Bajo. Es un decorador, y la instrumentación queda fuera del núcleo como RNF-11
exige.

---

### F-15 · Endpoint *bulk* con modos atómico, tolerante y paralelo — **Diferir**

**Qué hace Formance.** `POST /{ledger}/_bulk` acepta un lote de operaciones heterogéneas con
tres modos combinables: **atómico** (todo o nada, en una transacción), **continueOnFailure**
(sigue tras un error, reportando por elemento) y **paralelo** (pool de workers). Atómico y
paralelo son mutuamente excluyentes
(`internal/api/bulking/bulker.go`, `ErrAtomicParallelConflict`). Soporta streaming vía
content-types dedicados (`internal/api/v2/routes.go:187-193`).

**Qué ganamos.** El caso de uso existe: el automatizador de correos procesando un lote de
notificaciones. Hoy son N llamadas HTTP independientes, con N oportunidades de fallo parcial
y sin forma de pedir atomicidad.

**Por qué diferir.** El volumen no lo justifica todavía, y el diseño correcto depende de una
decisión que no está tomada: ¿un lote de finanzas personales debe ser atómico? Probablemente
no —que una notificación mal parseada tumbe las otras nueve es peor que registrar nueve—, lo
que reduce el bulk a "N llamadas con menos overhead", cuyo beneficio es marginal a esta
escala.

**Condición de disparo.** Que la latencia del registro por lotes se vuelva un problema medible.

---

## 6. Bloque D — Lectura y consulta

### F-16 · *Point in time* en las queries y paginación por cursor — **Adoptar** ⭐

**Qué hace Formance.** Toda consulta paginada lleva un instante de corte, expuesto como
`endTime` (PIT, *point in time*) y `startTime` (OOT):

```go
// internal/query_template.go:30-38, 41-47
type QueryTemplateParams[Opts any] struct {
    PIT        *time.Time   // json:"endTime"
    OOT        *time.Time   // json:"startTime"
    Expand     []string
    SortColumn string
    SortOrder  *paginate.Order
    PageSize   uint
}
```

El PIT se fija en la primera página y viaja dentro del cursor opaco, de modo que las páginas
siguientes ven exactamente el mismo estado aunque hayan entrado escrituras nuevas
(`internal/storage/common/cursor.go`, `paginator_column.go`).

**Qué ganamos.** Este es el hallazgo con mejor relación valor/costo del bloque de lectura.
Nuestra paginación es `offset`/`limit`:

```typescript
// apps/ledger/src/transactions/application/types/page-request.type.ts
export type PageRequest = { readonly limit: number; readonly offset: number };
```

Con offset y un stream que crece, paginar tiene dos defectos garantizados: **elementos
duplicados o saltados** cuando llega una transacción nueva entre dos páginas (que es
exactamente el caso normal de la bandeja de pendientes con el automatizador escribiendo), y
degradación de `OFFSET n` en tablas grandes.

Un cursor por columna con PIT fijado en la primera página elimina ambos. Y encaja
particularmente bien con nuestro diseño: ya tenemos un orden total (`global_position`) y
RNF-9 ya expone la posición del stream al cliente — el PIT es el mismo concepto aplicado a la
lectura.

**Adaptación.** El cursor opaco (base64 del estado de paginación: última clave, orden, PIT,
filtros) reemplaza `PageRequest`. Es un cambio de contrato (RNF-8), y es el momento barato de
hacerlo: no hay clientes en producción.

**Costo.** Medio, concentrado en los adaptadores de lectura y el contrato OpenAPI. El núcleo
no se entera: `PageRequest` es un tipo de aplicación, y los puertos de lectura ya están
aislados (ver `refactor-read-side-ports`).

---

### F-17 · Lenguaje de filtros estructurado, validado por esquema — **Adaptar**

**Qué hace Formance.** Los filtros son un árbol de expresiones con operadores tipados
(`$match`, `$lt`, `$gt`, `$lte`, `$gte`, `$like`, combinables con `$and`/`$or`), y **cada
propiedad declara qué operadores acepta**:

```go
// internal/storage/common/resource.go:37-53, 69-76, 136-139
func ConvertOperatorToSQL(operator string) string { ... }
func AcceptOperators(operators ...string) PropertyValidator { ... }
if !slices.Contains(property.Type.Operators(), operator) {
    return NewErrInvalidQuery("operator '%s' is not allowed for property '%s'", operator, name)
}
```

Un filtro inválido falla con un mensaje que nombra la propiedad y el operador, antes de tocar
la base.

**Qué ganamos.** RF-13 pide filtros por cuenta, período, estado, tipo derivado, payee y
`client_id`. Con query params planos, cada combinación nueva es un parámetro nuevo, y las
consultas compuestas ("gastos de Netflix **o** Spotify en julio, confirmados") no se expresan.
Un lenguaje estructurado las expresa sin ampliar el contrato, y la validación contra esquema
da errores accionables en vez de un 500 o un resultado vacío inexplicable.

**Adaptación.** Con dos cautelas fuertes: (a) es un **superconjunto** de RF-13, no un
reemplazo — los filtros comunes siguen como query params simples, el lenguaje es la vía
avanzada; (b) la validación por esquema es **obligatoria**, no opcional: un lenguaje de
filtros que llega crudo al SQL es una superficie de inyección y de consultas patológicas.

**Costo.** Medio-alto. Es el hallazgo con más riesgo de sobre-ingeniería del catálogo:
implementarlo entero para un ledger personal es desproporcionado. Recomendación: adoptar solo
`$and`/`$or` sobre los campos que RF-13 ya nombra, con validación estricta, y no más.

---

### F-18 · Saldos agregados por prefijo de la jerarquía — **Adoptar**

**Qué hace Formance.** Expone `GET /{ledger}/aggregate/balances`
(`internal/api/v2/routes.go:128`) con `groupBy`: agrega saldos por los primeros N segmentos
de la dirección. Las direcciones son segmentadas por `:`, igual que las nuestras, y hay una
capacidad dedicada a indexarlas.

**Qué ganamos.** Nuestra jerarquía por nombre (§2.1) existe precisamente para agrupar —
"todas las cuentas de Bancolombia", "todo el gasto en comida"— pero nuestras proyecciones
solo dan saldo **por cuenta exacta** (`account_balances`, §3.6). El saldo del subárbol hoy lo
tiene que armar el cliente sumando hojas, lo que significa que cada cliente reimplementa la
misma agregación, con sus propios bugs.

Es contabilidad, no reporte de producto: sumar un subárbol de cuentas no requiere tasas de
cambio ni conversión, así que **no cae en la exclusión de §4.2** (que saca valoración y
reportes consolidados). Es el complemento natural de `get-account-tree`, que ya existe.

**Adaptación.** Un query handler sobre `proj_balances` + `proj_accounts` que agrupa por
prefijo de `name` a profundidad N, devolviendo saldos **por moneda** (nunca consolidados —
consolidar exige tasas, y eso sí es capa de producto, principio #7). Con F-1, agrega
volúmenes además del saldo.

**Costo.** Bajo. Un query handler y un índice por prefijo.

---

### F-19 · Metadata como concepto de primera clase, con borrado — **Adaptar**

**Qué hace Formance.** La metadata es un ciudadano de primera clase con sus propios tipos de
entrada de log —`SET_METADATA` y `DELETE_METADATA` (`internal/log.go:21-24`)— aplicables a
ledger, cuenta y transacción, con `targetType`/`targetId` (`internal/log.go:266-322`), y con
historización opcional por entidad (F-20). El borrado es **por clave**, no reemplazo del
objeto completo (`DeleteAccountMetadata{Address, Key}`,
`internal/controller/ledger/controller.go:126-129`).

**Qué ganamos.** Dos huecos:

1. **No tenemos metadata en cuentas.** Nuestro `Account` (§2.1) tiene tipo, nombre, monedas y
   fechas, pero ningún lugar para "últimos 4 dígitos", "color en el frontend", "id de la
   cuenta en el banco". Hoy eso se acaba metiendo en el nombre —que es justo lo que degrada
   el plan de cuentas (ver F-8)— o en el cliente, donde se pierde.
2. **No tenemos borrado de claves.** `TransactionAnnotated` (§3.4, INV-6) permite agregar
   anotaciones; para quitar una etiqueta puesta por error hay que reenviar el objeto completo,
   lo que hace la operación *last-write-wins* y pierde la intención ("quité este tag") en el
   stream, que es justo lo que el event sourcing debería conservar.

**Adaptación.** Eventos `AccountMetadataSet` / `AccountMetadataDeleted`, y un
`TransactionAnnotationDeleted` con semántica por clave. Se mantiene INV-6: la metadata es
**anotativa**, nunca económica, y no toca postings ni saldos.

**Costo.** Bajo. Aditivo puro, encaja con el patrón existente.

---

## 7. Bloque E — Operabilidad y evolución

### F-20 · Capacidades activables por ledger — **Descartar como mecanismo, adoptar como disciplina**

**Qué hace Formance.** Cada ledger declara qué capacidades costosas quiere:

```go
// pkg/features/features.go:11-25, 29-42
FeatureMovesHistory                           = "MOVES_HISTORY"                                 // ON | OFF
FeatureMovesHistoryPostCommitEffectiveVolumes = "MOVES_HISTORY_POST_COMMIT_EFFECTIVE_VOLUMES"   // SYNC | DISABLED
FeatureHashLogs                               = "HASH_LOGS"                                     // SYNC | ASYNC | DISABLED
FeatureAccountMetadataHistory                 = "ACCOUNT_METADATA_HISTORY"                      // SYNC | DISABLED
FeatureTransactionMetadataHistory             = "TRANSACTION_METADATA_HISTORY"                  // SYNC | DISABLED
```

Con un `DefaultFeatures` completo y un `MinimalFeatureSet` con todo apagado.

**Por qué descartar el mecanismo.** Es una necesidad de multi-tenancy: distintos clientes con
distintos perfiles de costo sobre la misma instancia. Nosotros tenemos un ledger por usuario
y un solo perfil. Un sistema de flags configurable sería complejidad sin beneficio, y
multiplicaría las combinaciones a testear —justo lo que la regla de disciplina de §8.1 ("solo
la infraestructura que los requerimientos nombran") prohíbe.

**Qué sí vale la pena adoptar: la lista misma.** Esos cinco flags son el inventario que
Formance hizo de *"lo que cuesta caro y no todos necesitan"*. Confirma que F-2 (effective
volumes) y F-5 (hash logs) son las dos decisiones caras del catálogo, y que ambas admiten
modo síncrono o asíncrono — nuestra misma dicotomía de proyecciones (§8.1). La disciplina a
copiar es **decidir explícitamente el modo de cada capacidad cara**, no hacerlo configurable.

---

### F-21 · *Pipelines* de replicación con checkpoint reiniciable — **Diferir** (con nota para §9.3)

**Qué hace Formance.** Publica su log a destinos externos mediante *exporters* y *pipelines*,
con ciclo de vida completo: crear, arrancar, parar y **resetear** (`internal/api/v2/routes.go:90-102`,
`internal/pipeline.go`, `internal/exporter.go`). Cada pipeline mantiene su posición y puede
rebobinarse.

**Qué aporta a nuestra decisión ya tomada.** §8.1 y §9.3 difieren la publicación de eventos y
la resuelven, cuando llegue, con **CDC vía Debezium**. Formance resolvió el mismo problema
*dentro* del ledger, con un poller con checkpoint por destino — es decir, la misma máquina
que ya tenemos (`ProjectionDispatcher` + `projection_checkpoints`, EP-1.9) apuntando hacia
afuera en vez de hacia adentro.

Esto es un argumento concreto contra Debezium para nuestro caso: el costo operativo (broker +
conector + replication slots) que §8.1 identifica como razón para diferir **no desaparece**
cuando llegue el primer consumidor; y un exporter interno reutiliza infraestructura ya
construida y probada. La ventaja de Debezium —no acoplar la publicación al proceso— importa a
escala de plataforma, no a la nuestra.

**Recomendación.** No construir nada ahora. Sí **anotar en §9.3** que existe una tercera
opción entre "nada" y "Debezium": un exporter con checkpoint sobre el mismo mecanismo del
poller, con ciclo de vida start/stop/reset. La decisión se toma cuando aparezca el consumidor,
con las tres opciones sobre la mesa en vez de dos.

---

### F-22 · Decoradores encadenados sobre el controlador de escritura — **Adoptar**

**Qué hace Formance.** El `Controller` es una interfaz, y las preocupaciones transversales
son implementaciones que lo envuelven, una por archivo:

```
internal/controller/ledger/
  controller.go                              # la interfaz
  controller_default.go                      # la implementación real
  controller_with_cache.go                   # caché
  controller_with_events.go                  # publicación de eventos
  controller_with_traces.go                  # instrumentación OTel
  controller_with_too_many_client_handling.go # saturación de conexiones
```

**Qué ganamos.** RNF-11 y RNF-12 ya exigen que la instrumentación viva "en adaptadores y
decoradores de los buses, nunca dentro del dominio". Lo que Formance aporta es la **forma
concreta**: un archivo por preocupación, cada uno implementando la misma interfaz y delegando,
componibles en el wiring. Es donde encajan sin fricción F-12 (dry-run), F-14 (retry) y las
métricas de RNF-12 — sin que ningún command handler se entere de que existen.

**Costo.** Nulo si el command bus ya tiene un punto de composición; es una convención de
organización, no funcionalidad.

---

### F-23 · Plantillas de transacción nombradas — **Diferir**

**Qué hace Formance.** Una transacción puede declarar de qué plantilla nació
(`internal/transaction.go:52`, campo `Template`), y las plantillas se registran en el schema
versionado (`internal/transaction_templates.go`). Es la versión declarativa y acotada de lo
que Numscript hace de forma general.

**Qué ganamos.** §9.3 prevé "transacciones periódicas / recurrentes" como módulo de producto
o cliente automatizado. Las plantillas son la mitad de esa funcionalidad que **sí** pertenece
al núcleo: la forma canónica de un asiento repetido (arriendo, suscripción, nómina) con sus
cuentas y su estructura fijas, y el monto como parámetro. El calendario —lo que decide
*cuándo* generarla— sigue siendo del cliente, que es la separación correcta.

Beneficio adicional: la trazabilidad. Saber que 24 transacciones nacieron de la plantilla
"arriendo" es un dato de auditoría que hoy solo se puede inferir por payee.

**Por qué diferir.** No hay requerimiento activo, y §9.3 ya ubica lo recurrente fuera. La
nota vale para cuando ese módulo se diseñe: **la plantilla puede vivir en el ledger aunque el
calendario no**.

---

## 8. Descartes explícitos

Ideas centrales de Formance que **no** deberían entrar, para que su ausencia no se lea como
omisión:

| Idea | Motivo del descarte |
|---|---|
| **Numscript** (DSL de transacciones con allocations, portions, `remaining`, `overdraft`) | Resuelve el reparto programático de fondos en flujos de pago multi-parte. En finanzas personales los postings vienen del extracto, no de una regla. Un DSL Turing-incompleto pero no trivial es una superficie de ejecución, un compilador y un runtime que mantener, para un caso de uso inexistente. La parte útil —plantillas parametrizadas— se rescata en F-23 sin el lenguaje |
| **Postings unidireccionales** (`source`/`destination`, monto siempre positivo) | Hace triviales los volúmenes, pero fuerza dos filas por posting y pierde la expresión natural de un asiento con N líneas (RF-10). Nuestro modelo con signo obtiene lo mismo derivando (F-1). Cambiarlo sería invasivo sin ganancia |
| **Cuentas creadas implícitamente al primer uso** | Contradice INV-3 e INV-13. La apertura explícita fechada es un requisito contable (§2.1), no una fricción a eliminar. Lo único rescatable es `FirstUsage` como dato de proyección |
| **`@world` y saldos negativos ilimitados** | `@world` es la fuente infinita que hace que el sistema no sea de partida doble estricta en su frontera. Nuestro equivalente —`Equity:OpeningBalances`— es una cuenta real del plan, sujeta a las mismas reglas (INV-13). Su modelo es más flexible; el nuestro es más correcto contablemente |
| **Fondos insuficientes como error de dominio** (`ErrInsufficientFunds`, `overdraft`) | Presupone que el ledger *autoriza* movimientos. El nuestro **registra lo que ya ocurrió** (principio #6): un sobregiro real del banco debe poder registrarse, no rechazarse |
| **Escala del activo en su nombre** (`USD/2`) | Nuestro catálogo de monedas con `minor_units` como dato de referencia event-sourced (§2.5, INV-8) es estrictamente mejor: la precisión es un atributo de la moneda, no un sufijo del identificador |
| **Multi-ledger, buckets y esquemas por tenant** | Necesidad de multi-tenancy. INV-9 (un stream por usuario) cubre nuestro aislamiento con una fracción de la complejidad |
| **Query templates** (`POST /queries/{id}/run`, consultas guardadas y versionadas en el schema) | Resuelve que clientes heterogéneos no armen filtros crudos contra una API pública. Con dos clientes conocidos, es indirección sin beneficio |

---

## 9. Síntesis priorizada

Orden sugerido por relación valor/costo. Las ⭐ son las que cambian algo estructural.

| # | Hallazgo | Veredicto | Valor | Costo | Toca |
|---|---|---|---|---|---|
| F-10 ⭐ | Hash de inputs junto a la clave de idempotencia | Adoptar | Alto | Bajo | INV-10, RF-11, RF-14 |
| F-5 ⭐ | Cadena de hashes sobre el event store | Adoptar | Alto | Bajo-medio | INV-12, RNF-3, §6.1 |
| F-6 | Excluir derivados del hash (*memento*) | Adoptar | — | Nulo | Diseño de F-5 |
| F-1 | Volúmenes `(input, output)` | Adoptar | Alto | Bajo | §6.2, RNF-5 |
| F-12 | Dry run por rollback | Adoptar | Medio-alto | Bajo | §3.5, contrato API |
| F-18 | Saldos agregados por prefijo de jerarquía | Adoptar | Medio-alto | Bajo | §3.6, RF-13 |
| F-14 | Reintento ante deadlock, relectura ante colisión | Adaptar | Medio-alto | Bajo | RF-14, RNF-12 |
| F-22 | Decoradores encadenados en el command bus | Adoptar | Medio | Nulo | RNF-11, RNF-12 |
| F-19 | Metadata de cuenta + borrado por clave | Adaptar | Medio | Bajo | §2.1, §3.4, INV-6 |
| F-9 | Modo estricto vs. permisivo para validaciones nuevas | Adoptar | Medio | Trivial | Rollout de F-8 |
| F-13 | `atEffectiveDate` elegible + código de error estable | Adaptar | Bajo-medio | Bajo | RF-7, RF-14, §7.3 |
| F-16 ⭐ | PIT + paginación por cursor | Adoptar | Alto | Medio | RF-13, RNF-8, RNF-9 |
| F-8 ⭐ | Plan de cuentas declarativo y versionado | Adaptar | Alto | Medio | §2.1, RF-1, INV-14 |
| F-3 | Doble fecha en `proj_postings` | Adaptar | Medio | Bajo | §6.2 |
| F-4 | Semántica explícita del back-dating | Adoptar | Medio | Documental | §2.4, RNF-7, §8.2 #6 |
| F-2 ⭐ | Post-commit effective volumes | Adaptar | Muy alto | Alto | §2.4, RF-18, §8.2 #6 |
| F-17 | Lenguaje de filtros validado por esquema | Adaptar (recortado) | Medio | Medio-alto | RF-13 |
| F-11 | Separar *reference* de *idempotency key* | Adaptar | Medio | Medio | §2.11, RNF-8 |
| F-7 | Export/import del log | Diferir | Medio | Medio | §8.2 #8 |
| F-15 | Endpoint bulk | Diferir | Bajo | Medio | — |
| F-21 | Exporter con checkpoint como tercera vía al CDC | Diferir | — | — | §9.3 (nota) |
| F-23 | Plantillas de transacción | Diferir | — | — | §9.3 (nota) |
| F-20 | Capacidades activables | Descartar (mecanismo) | — | — | Disciplina de §8.1 |

**Los tres que más mueven la aguja**, si hubiera que elegir tres:

1. **F-10** — cierra un fallo silencioso real del protocolo de idempotencia por el costo de una columna.
2. **F-5 + F-6** — convierte la promesa de auditabilidad (RNF-3) en una propiedad verificable en vez de una confianza en el trigger.
3. **F-2** — es el único que reordena algo estructural, y a cambio resuelve la evaluación de aserciones, la pregunta abierta #6 y el saldo corrido del extracto de una sola vez.

---

## 10. Impacto documental si se adopta

Secciones de [`ledger-spec.md`](../ledger-spec.md) que habría que tocar, para dimensionar el
trabajo de spec antes del de código:

| Sección | Cambio |
|---|---|
| §2.1 Account | Metadata de cuenta (F-19); referencia al plan de cuentas declarativo (F-8) |
| §2.4 Balance Assertion | Evaluación vía volúmenes efectivos (F-2); semántica de back-dating (F-4) |
| §2.11 External Reference | Precisar la semántica actual y el hash de inputs (F-10); nota sobre separar *reference* (F-11) |
| §3.4 Catálogo de eventos | `ChartOfAccountsDefined`, `AccountMetadataSet/Deleted`, `TransactionAnnotationDeleted` |
| §3.5 Commands | Parámetro `dryRun` (F-12) |
| §3.6 Proyecciones | Volúmenes en `account_balances` (F-1); doble fecha y volúmenes efectivos en `proj_postings` (F-2, F-3); agregación por prefijo (F-18) |
| §6.1 Event store | Columnas `hash` y `external_ref_hash` (F-5, F-10) |
| §6.2 Proyecciones | Esquema de F-1/F-3 |
| §7 Contrato del API | Cursor y PIT (F-16); `Idempotency-Hit`; endpoint de saldos agregados |
| §7.3 Flujo de corrección | Documentar la fecha de la reversa y hacerla elegible (F-13) |
| §8.2 Preguntas abiertas | #6 se cierra con F-2 + F-4 |
| §9.3 Extensiones | Nota del exporter con checkpoint como tercera vía (F-21); plantillas (F-23) |
| RF-14 / códigos de error | `IDEMPOTENCY_INPUT_MISMATCH`, `TRANSACTION_ALREADY_REVERSED`, `ACCOUNT_NOT_IN_CHART` |
| RNF-3 | La auditabilidad pasa de "el stream registra" a "el stream registra **y es verificable**" |
| RNF-12 | Métrica de deadlocks reintentados (F-14) |

---

## 11. Nota de honestidad sobre el análisis

Tres advertencias para quien use este documento:

1. **El código se leyó, no se ejecutó.** Las citas son verificables línea a línea, pero no se
   corrió Formance ni se midió ninguna de sus optimizaciones. Las afirmaciones de costo son
   estimaciones sobre *nuestro* código, no benchmarks.
2. **Formance resuelve problemas de escala que no tenemos.** Varias de sus decisiones existen
   porque una cuenta puede tener millones de movimientos. Adoptarlas por elegancia y no por
   necesidad contradice la regla de disciplina de §8.1. Los veredictos "Diferir" y "Descartar"
   de este documento son tan parte del aporte como los "Adoptar".
3. **Nada aquí está decidido.** Cada hallazgo con veredicto Adoptar o Adaptar necesita pasar
   por el flujo normal (`/hu` → `/clarify` → `/design`) antes de convertirse en código. Este
   documento es el insumo de esa conversación, no su conclusión.
