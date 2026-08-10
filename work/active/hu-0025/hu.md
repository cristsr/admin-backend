# hu-0025: Políticas transversales del command bus

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgos **F-12** (dry run), **F-14** (retry ante deadlock) y **F-22** (decoradores).
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 1.

## Historia de Usuario

**Como** cliente del ledger (frontend o automatizador)
**Quiero** poder previsualizar el efecto de un comando sin ejecutarlo, y que los fallos
transitorios del motor se resuelvan solos
**Para** decidir con información real antes de escribir, y no recibir errores por carreras de
locks que el servidor puede reintentar en microsegundos

## Criterios de Aceptación

### AC-1: Las preocupaciones transversales son decoradores componibles

El command bus expone un punto de composición donde cada preocupación transversal vive en su
propio decorador, implementando la misma interfaz y delegando en el siguiente. Un decorador no
conoce a los otros ni al handler concreto.

Los decoradores de esta historia (dry-run, retry) y los que ya existen (idempotencia,
contexto, concurrencia optimista) quedan bajo el mismo mecanismo.

La instrumentación permanece fuera del núcleo (RNF-11): ningún command handler cambia por esta
historia.

### AC-2: `dryRun` ejecuta todo y revierte

Los commands aceptan un parámetro `dryRun`. Cuando es `true`:

- el comando se ejecuta **completo** —validaciones, invariantes del agregado, generación de
  eventos y actualización de las proyecciones síncronas— dentro de la transacción;
- al terminar se hace **rollback** en vez de commit;
- se devuelve el resultado que la ejecución real habría producido.

El preview no puede divergir de la ejecución real porque es la ejecución real.

### AC-3: `dryRun` no produce efectos observables

En modo dry-run:

- no se emite ningún evento al stream;
- no se despacha ningún reactor (§3.2), para que la re-evaluación de aserciones no se dispare
  por una simulación;
- los ids generados no se "queman": un `IdGenerator` determinista o descartable evita que un
  dry-run consuma identificadores que luego aparecen salteados.

### AC-4: `dryRun` se expone en el API

**Todos** los endpoints de escritura aceptan el modo dry-run, sin excepciones, y devuelven el
resultado simulado con el mismo esquema de respuesta que la ejecución real.

El modo viaja como **campo del body** (`dryRun: boolean`, default `false`), validado con
`class-validator` junto al resto del DTO — no como query param.

### AC-5: Los deadlocks del motor se reintentan

- **CUANDO** el adaptador de persistencia falla con `40P01 (deadlock_detected)` o `40001
  (serialization_failure)` —los únicos dos errores transitorios cubiertos—, **EL SISTEMA
  DEBE** reintentar el comando completo en vez de propagar el error al cliente.
- **MIENTRAS** queden intentos disponibles, **EL SISTEMA DEBE** aplicar backoff exponencial
  con jitter (~10–40 ms) entre reintentos, hasta un máximo de **3 intentos en total**
  (intento original + 2 reintentos).
- **SI** se agotan los 3 intentos, **ENTONCES EL SISTEMA DEBE** responder con el código de
  dominio estable `PERSISTENCE_CONFLICT`, sin exponer el error crudo del motor.

> Original: "Cuando el adaptador de persistencia falla por un deadlock o un error transitorio
> equivalente de PostgreSQL, el comando se reintenta automáticamente en vez de propagar el
> error al cliente. El comando era válido: solo perdió una carrera de locks."

### AC-6: El conflicto de concurrencia optimista NO se reintenta ciegamente

Un conflicto de concurrencia optimista sobre el agregado (`CONCURRENCY_CONFLICT`) **no** entra
en el reintento automático: el comando tomó su decisión sobre un estado que ya cambió, y
repetirlo sin recargar produciría una escritura basada en premisas viejas.

Se sigue propagando al cliente como hoy.

### AC-7: La colisión de referencia externa relee en vez de fallar

Cuando dos reintentos simultáneos con la misma `external_ref` compiten y uno pierde la carrera
del índice único, el perdedor **relee** el resultado ya escrito y lo devuelve, en vez de
responder `DUPLICATE_EXTERNAL_REF`.

La verificación de que los inputs coinciden es la de `hu-0024` (AC-6): si no coinciden, gana
`IDEMPOTENCY_INPUT_MISMATCH`.

### AC-8: Los reintentos son observables

Cada reintento por deadlock incrementa un contador con el tipo de comando como atributo. La
métrica se suma a las tres que RNF-12 ya nombra (lag de proyecciones, conflictos de
concurrencia, errores de projectors y reactors).

## Reglas de Negocio

- El reintento distingue **tres** causas y las trata distinto: transitorio del motor
  (reintentar), conflicto de agregado (propagar), colisión de idempotencia (releer). Tratarlas
  igual es la forma de convertir un bug de concurrencia en corrupción silenciosa.
- Un comando reintentado debe producir el mismo resultado que el original: el reintento se
  apoya en que los handlers son deterministas dado el mismo estado de partida.

## Resolución de Ambigüedades

- **AC-4:** ¿`dryRun` en todos los commands o solo en los de caso de uso claro? → En **todos**
  los commands de escritura, sin excepciones (mecanismo transversal uniforme).
- **AC-4:** ¿Query param, body, o ambos? → **Campo del body** (`dryRun: boolean`, default
  `false`), validado con `class-validator`; no query param.
- **AC-5:** ¿Qué errores de PostgreSQL se consideran transitorios? → Solo `40P01
  (deadlock_detected)` y `40001 (serialization_failure)`; lista cerrada y explícita.
- **AC-5:** ¿Cuántos reintentos, con qué backoff, y qué se devuelve al agotarlos? → **3
  intentos totales** con **backoff exponencial con jitter**; al agotar, código de dominio
  estable `PERSISTENCE_CONFLICT` (no el error crudo del motor).

## Fuera de Alcance

- Endpoint bulk (F-15): diferido, sin condición de disparo cumplida.
- Manejo de saturación de conexiones (`too many clients`). Formance tiene un decorador
  dedicado; aquí no hay evidencia de que el problema exista.

## Technical Context

### App/lib objetivo
- `ledger` (app)
