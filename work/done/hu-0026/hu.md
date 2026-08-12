# hu-0026: Fecha efectiva elegible en la reversa

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgo **F-13**.
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 1.

## Historia de Usuario

**Como** usuario que corrige un error contable
**Quiero** elegir si la reversa de una transacción confirmada se asienta en la fecha original o
en la fecha de hoy
**Para** poder corregir el saldo histórico cuando el período sigue abierto, y dejarlo intacto
cuando el período ya fue conciliado y cerrado

## Criterios de Aceptación

### AC-1: `atEffectiveDate` es un parámetro explícito del comando

`ReverseConfirmedTransaction` acepta `atEffectiveDate: boolean`, y la fecha resultante la
decide el agregado en un único lugar: `LedgerTransaction.reverse()` recibe la elección y la
resuelve dentro del `ReversalPlan` que devuelve, que el handler pasa a usar en lugar de
reconstruir la reversa por su cuenta.

- **CUANDO** se reversa una transacción confirmada con `atEffectiveDate: true`, **EL SISTEMA
  DEBE** fechar la transacción de reversa con la fecha contable de la original.
- **CUANDO** se reversa una transacción confirmada con `atEffectiveDate: false`, **EL SISTEMA
  DEBE** fechar la transacción de reversa con la fecha de hoy, obtenida como
  `clock.now()` truncado a `YYYY-MM-DD` en UTC.
- **DONDE** el cliente no envía el parámetro, **EL SISTEMA DEBE** aplicar `true`, que es el
  comportamiento actual (`reverse-confirmed-transaction.handler.ts:51` copia
  `date: original.date`) y el contablemente correcto por omisión.

> Original: "`ReverseConfirmedTransaction` acepta `atEffectiveDate: boolean`: `true` → la
> transacción de reversa nace con la fecha contable de la original (…); `false` → la reversa
> nace con la fecha de hoy (…). El default es `true`."

**Efecto sobre las aserciones — observable, no construido.** La reversa emite su propio
`TransactionRecorded`, y el reactor de RF-18 ya re-evalúa las aserciones alcanzadas por la
fecha y las cuentas de ese evento. Con `true` se corrige el saldo histórico y se re-evalúan
las aserciones posteriores a la fecha original; con `false` el histórico queda intacto y las
aserciones anteriores a hoy no cambian de veredicto. Ninguna de las dos ramas requiere código
en el reactor.

**Sin validación de coherencia temporal:** el sistema no compara la fecha de hoy con la de la
original. Si la original está fechada a futuro, la reversa puede quedar fechada antes que
ella y eso se acepta.

### AC-2: El efecto sobre la conciliación queda documentado

`§7.3` de la especificación describe el flujo de corrección pero no dice con qué fecha nace la
reversa; hoy la decisión existe solo en el código, sin quedar registrada como decisión.

Tras esta historia:

- `docs/ledger-spec.md` §7.3 nombra la elección `atEffectiveDate`, su default, y qué le pasa a
  las aserciones de saldo posteriores en cada rama. Se edita directamente: es la spec de
  producto, fuera del ciclo de reconciliación de docs.
- `apps/ledger/docs/transactions/flows/reverse-transaction.md` y
  `apps/ledger/docs/transactions/api.yaml` reflejan el parámetro y el nuevo código de error.
  Los produce `/design` como delta y los reconcilia `/sync`; no se editan a mano durante la
  implementación.

### AC-3: La doble reversa tiene un código de error estable

Revertir dos veces la misma transacción confirmada ya está impedido
(`ledger-transaction.aggregate.ts:174-176`), pero lanza `InvalidTransactionStateException`, un
error genérico que el cliente no puede distinguir de cualquier otro estado inválido.

- **SI** se intenta reversar una transacción que ya fue reversada, **ENTONCES EL SISTEMA
  DEBE** rechazar con `TransactionAlreadyReversedException` (una `DomainConflictException`),
  código estable `TRANSACTION_ALREADY_REVERSED` (RF-14) y HTTP 409.
- **EL SISTEMA DEBE** registrar el código nuevo en `LEDGER_ERROR_CODE` y su fila en
  `ledger-error-code-mapping.spec.ts`, que congela el contrato código → status.
- **SI** se intenta reversar una transacción que no está `CONFIRMED` por cualquier otro
  motivo, **ENTONCES EL SISTEMA DEBE** seguir rechazando con `INVALID_TRANSACTION_STATE`: el
  código nuevo cubre únicamente la doble reversa.

> Original: "Tras esta historia el rechazo usa el código estable `TRANSACTION_ALREADY_REVERSED`
> (RF-14), mapeado a HTTP 409."

### AC-4: El endpoint expone la elección

- **EL SISTEMA DEBE** aceptar `atEffectiveDate` como campo booleano opcional del body de
  `POST /transactions/{id}/reverse`, declarado en `ReverseTransactionRequestDto` con
  `@IsOptional() @IsBoolean()`, y propagarlo al comando.
- **DONDE** el body no trae el campo, **EL SISTEMA DEBE** resolver el default en el controller
  (`dto.atEffectiveDate ?? true`), de modo que el comando siempre reciba un valor explícito y
  el contrato siga siendo compatible con clientes que no conozcan el parámetro.

> Original: "`POST /transactions/{id}/reverse` acepta el parámetro y lo propaga al comando. Si
> el cliente no lo envía, aplica el default de AC-1."

### AC-5: La elección entra en la idempotencia

`IdempotencyPolicy` hashea `canonicalJson({ userId, command })` completo, así que un campo
nuevo del comando entra al hash por construcción. El AC existe para que quede verificado, no
porque requiera código nuevo.

- **SI** se reintenta la reversa con la misma `external_ref` y un `atEffectiveDate` distinto
  al del intento original, **ENTONCES EL SISTEMA DEBE** rechazar con
  `IDEMPOTENCY_INPUT_MISMATCH` y HTTP 409 (Artículo 6 de `docs/rules.md`).
- **CUANDO** se reintenta con la misma `external_ref` y el mismo `atEffectiveDate`, **EL
  SISTEMA DEBE** replicar el resultado original sin emitir eventos nuevos.

## Reglas de Negocio

- La elección de fecha **no** relaja INV-6: los atributos económicos de la confirmada original
  siguen siendo inmutables. Lo que se elige es la fecha de la transacción **nueva** de reversa,
  no una modificación de la original.
- `force` de Formance no se adopta: presupone que el ledger autoriza movimientos por
  disponibilidad de fondos, y este ledger **registra lo que ya ocurrió** (principio de diseño
  #6). Un sobregiro real debe poder registrarse.
- La fecha de la reversa se decide en **un solo lugar**: el agregado, dentro del
  `ReversalPlan`. Hoy convive con una copia en el handler; al terminar esta historia no debe
  quedar ninguna segunda fuente de verdad para esa fecha.
- El ledger **no** infiere si el período está cerrado ni condiciona la elección a ello. Elegir
  es del cliente; el ledger obedece.

## Fuera de Alcance

- Cualquier cambio al vínculo `reverses_id` entre la original y la reversa: ya existe y
  funciona (§3.4).
- El `reason?` del body de `POST /transactions/{id}/reverse`, que hoy se declara y se
  ignora (`transactions.controller.ts:207`). Es un gap conocido y documentado; esta
  historia no lo cierra.
- Cualquier noción de «período contable cerrado» en el ledger: la elección de fecha es del
  cliente y el ledger no la infiere (ver Resolución de Ambigüedades).

## Resolución de Ambigüedades

- **AC-1 · consultada:** ¿la elección de fecha se unifica en el agregado o se resuelve
  en el handler al mínimo costo? → **Se unifica en el agregado**: `reverse()` recibe la
  elección y devuelve el `ReversalPlan` con la fecha ya resuelta; el handler registra la
  reversa a partir de ese plan (decisión del desarrollador).
  *Por qué se consultó:* categoría **alcance** — hoy el agregado ya devuelve un
  `ReversalPlan` que el handler descarta (`reverse-confirmed-transaction.handler.ts:49-65`
  reconstruye fecha, postings negados y descripción por su cuenta), así que la fecha se
  decide en dos lugares. Unificar arregla una duplicación preexistente que el ítem no
  nombraba.

- **AC-1 · autónoma (media-alta):** ¿`atEffectiveDate: boolean` o un enum
  `ORIGINAL | TODAY`? → **`boolean` con ese nombre**.
  *Fundamento:* el propio ítem lo especifica así (paridad con Formance, F-13) y el borde
  del comando ya usa flags booleanos.
  *Fuente:* AC-1 (nivel 5) + `ReverseTransactionRequestDto.dryRun` (nivel 3).

- **AC-1 · autónoma (media):** ¿Qué es exactamente «la fecha de hoy»? → **`clock.now()`
  truncado a `YYYY-MM-DD` en UTC**.
  *Fundamento:* es el único precedente de fecha contable que el sistema se asigna a sí
  mismo. Derivarla en la timezone del ledger exigiría inyectar `LedgerTimezoneReader` en
  `transactions`, que el ítem no pide (Simplicity Gate).
  *Fuente:* `resolve-discrepancy.handler.ts:70` — `this.clock.now().toISOString().slice(0, 10)`
  (nivel 3).
  *Inconsistencia registrada:* `day-boundary.resolver.ts:77` deriva el día en la timezone
  del ledger para el corte de las aserciones. Conviven dos nociones de «día»; esta decisión
  se alinea con la de transacciones, no con la de reconciliación.

- **AC-1 · autónoma (alta):** ¿`atEffectiveDate: false` requiere código para que «las
  aserciones anteriores a hoy no se vean afectadas»? → **No, es consecuencia del mecanismo
  existente**.
  *Fundamento:* la reversa emite su propio `TransactionRecorded`, que el reactor ya
  consume; qué aserciones re-evalúa se deriva de la fecha y las cuentas de ese evento.
  El AC se redacta como efecto observable, no como comportamiento a construir.
  *Fuente:* `reevaluate-assertions.reactor.ts` · `REEVALUATION_TRIGGERS` (nivel 3).

- **AC-1 · autónoma (alta):** ¿El ledger valida que el período esté cerrado y fuerza la
  elección? → **No: la elección es del cliente, sin inferencia ni validación**.
  *Fundamento:* el ledger no tiene concepto de cierre de período — no existe en el código —
  y el encuadre pide poder *elegir*, no que el sistema decida.
  *Fuente:* encuadre + AC-1 (nivel 5).

- **AC-1 · autónoma (media-baja):** ¿Qué pasa si con `atEffectiveDate: false` la fecha de
  hoy resulta **anterior** a la de la original (original fechada a futuro)? → **Se permite,
  sin validación adicional**.
  *Fundamento:* `RecordTransaction` no valida la fecha contra hoy en ningún caso; el ledger
  registra lo que se le declara (principio de diseño #6).
  *Sin precedente directo:* el repo no tiene ninguna regla sobre fechas futuras.

- **AC-5 (nuevo) · autónoma (alta):** ¿`atEffectiveDate` participa de la idempotencia? →
  **Sí, sin código nuevo**: `IdempotencyPolicy` hashea `canonicalJson({ userId, command })`
  completo, así que un campo nuevo del comando entra al hash por construcción.
  *Fundamento:* el Artículo 6 exige que reintentar con la misma `external_ref` e inputs
  distintos se rechace con `IDEMPOTENCY_INPUT_MISMATCH`.
  *Fuente:* `docs/rules.md` Artículo 6 (nivel 1) + `idempotency.policy.ts:46` (nivel 3).
  Se agrega como AC porque es comportamiento verificable que ningún AC capturaba.

- **AC-3 · autónoma (alta):** ¿Cómo se materializa `TRANSACTION_ALREADY_REVERSED`? →
  **`TransactionAlreadyReversedException extends DomainConflictException`** (que ya mapea a
  409), con su entrada en `LEDGER_ERROR_CODE` y su fila en el contrato de mapeo.
  *Fundamento:* precedente fuerte y normativo — el catálogo se declara fuente única de los
  códigos y el spec de mapeo dice «Adding a code obliges adding a row here».
  *Fuente:* `ledger-error-code.ts:1-8`, `transaction.exception.ts:31`,
  `ledger-error-code-mapping.spec.ts:34-39` (nivel 3).

- **AC-3 · autónoma (alta):** ¿Cambia también el código de «la transacción no está
  CONFIRMED»? → **No**: sigue siendo `INVALID_TRANSACTION_STATE`. Solo la doble reversa
  estrena código.
  *Fuente:* el ítem acota el cambio a ese caso (nivel 5).

- **AC-3 · autónoma (alta):** ¿Cambiar el `code` que hoy recibe el cliente ante doble
  reversa es breaking? → **No requiere versionado de API**.
  *Fundamento:* el status sigue siendo 409 — lo que el catálogo declara breaking es cambiar
  el status de un código, no afinar qué código emite una condición — y el proyecto está en
  fase de desarrollo, sin nada deployado.
  *Fuente:* `CLAUDE.md` (nivel 2) + `ledger-error-code.ts:1-8` (nivel 3).

- **AC-4 · autónoma (alta):** ¿El parámetro viaja en el body o en la query? → **Campo
  opcional del body** en `ReverseTransactionRequestDto`, con `@IsOptional() @IsBoolean()`.
  *Fuente:* `DTO_STYLE` del profile (nivel 2) + precedente de `dryRun` en el mismo DTO
  (nivel 3).

- **AC-4 · autónoma (alta):** ¿Dónde se aplica el default? → **En el controller**, con
  `dto.atEffectiveDate ?? true`, de modo que el comando siempre reciba un valor explícito.
  *Fuente:* el propio controller lo hace así con todos sus opcionales — `dto.payee ?? null`,
  `dto.tags ?? []`, `dto.occurredAt ?? null` (nivel 3).

- **AC-2 · autónoma (alta):** ¿Qué documentos se tocan y quién los toca? →
  `docs/ledger-spec.md` §7.3 se edita directo (es la spec de producto, fuera del ciclo de
  reconciliación); `apps/ledger/docs/transactions/flows/reverse-transaction.md` y
  `apps/ledger/docs/transactions/api.yaml` los reconcilia `/sync` desde el delta de
  `/design`, no la implementación.
  *Fuente:* `profile.md` §8 — `SYNC_MODE: reconcile`, `DESIGN_OUTPUT_MODE: delta` (nivel 2).

### Búsquedas sin resultado

- **Cierre de período contable:** no existe en el código. El encuadre lo nombra como
  motivación del caso de uso, no como funcionalidad a construir ni a consultar.
- **Fechas futuras:** ninguna regla, validación ni test acota la fecha de una transacción
  contra el presente.
