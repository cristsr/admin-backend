# hu-0028: Volúmenes efectivos post-commit y back-dating

> Origen: [`docs/proposals/formance-ledger-ideas.md`](../../../docs/proposals/formance-ledger-ideas.md)
> — hallazgos **F-2** (post-commit effective volumes) y **F-4** (semántica del back-dating).
> Épica: [EP-6](../../ledger/EP-6-formance.md), Ola 2. **Depende de `hu-0027`.**
> Cierra la **pregunta abierta #6** de la especificación (§8.2).

## Historia de Usuario

**Como** usuario que concilia sus cuentas contra el extracto bancario
**Quiero** que el ledger sepa qué saldo tenía cada cuenta en cualquier momento del pasado
**Para** que las aserciones de saldo se evalúen leyendo un dato en vez de recalculando todo el
historial, y para ver el saldo corrido junto a cada movimiento como en un extracto real

## Criterios de Aceptación

### AC-1: Cada posting confirmado registra el saldo resultante

Cada fila de `proj_postings` correspondiente a una transacción `CONFIRMED` registra el volumen
de la cuenta **después** de aplicarse ese posting, siguiendo el orden contable definido en
`hu-0027` (AC-5).

Es el "saldo corrido" del extracto: la columna que el usuario espera ver junto a cada
movimiento, sin que el frontend acumule nada.

### AC-2: Solo las confirmadas fijan saldo histórico

Los volúmenes efectivos se calculan **únicamente** sobre transacciones `CONFIRMED`.

Una transacción `PENDING` no fija saldo histórico porque todavía admite enmienda económica
(RF-6): fijarlo obligaría a recalcularlo en cada `AmendPendingTransaction`.

El saldo pendiente sigue siendo el volumen agregado de `hu-0027`, sin variante histórica.

### AC-3: Una transacción con fecha anterior recalcula hacia adelante

Cuando se confirma una transacción cuya fecha contable es anterior a postings ya proyectados de
las mismas cuentas, el proyector **recalcula** los volúmenes efectivos de esos postings
posteriores.

El recálculo ocurre dentro de la misma transacción del proyector y es idempotente: repetirlo
produce el mismo resultado.

[NEEDS CLARIFICATION: ¿el recálculo tiene un límite de antigüedad (p. ej. no recalcular más
allá de N meses o de la última aserción conciliada), o siempre recalcula toda la cola de la
cuenta? Sin límite, una transacción muy vieja puede disparar un recálculo largo.]

### AC-4: La evaluación de aserciones lee en vez de agregar

`AssertionEvaluator` obtiene el saldo del corte leyendo el volumen efectivo del último posting
confirmado anterior al corte, en lugar de sumar todos los postings de la cuenta.

El resultado de la evaluación es **idéntico** al actual para todos los casos que la suite de
`hu-0009`/EP-3.2 ya cubre: esta historia cambia cómo se obtiene el saldo, no qué veredicto se
produce.

### AC-5: La re-evaluación de aserciones deja de recalcular a ciegas

El reactor de re-evaluación (RF-18) sigue disparándose ante los mismos eventos, pero la
evaluación resultante es una lectura, no una agregación completa del historial de la cuenta.

### AC-6: El back-dating queda especificado

La especificación declara explícitamente que registrar una transacción con fecha anterior a
otras ya registradas es una operación **soportada**, y cuál es su consecuencia: recálculo de
volúmenes efectivos (AC-3), re-evaluación de las aserciones posteriores (AC-5) y orden de
desempate según `hu-0027` (AC-5).

Hoy la respuesta implícita es "las proyecciones lo suman y ya", correcta para el saldo actual
pero inconsistente para cualquier saldo histórico.

### AC-7: La pregunta abierta #6 queda cerrada

`§8.2` pregunta #6 (orden intradía cuando conviven transacciones con y sin `occurred_at` frente
a aserciones intradía) se cierra: el problema no era la regla `INDETERMINATE` sino que no había
forma barata de saber qué saldo había en un instante. Con volúmenes efectivos, el instante es
consultable.

[NEEDS CLARIFICATION: ¿la regla conservadora `INDETERMINATE` vigente se mantiene tal cual, se
relaja, o se elimina? Con el saldo por instante disponible, parte de la ambigüedad que la
motivaba desaparece — pero no toda: un posting sin `occurred_at` sigue sin tener posición
intradía.]

### AC-8: Los volúmenes efectivos no entran al stream

Los volúmenes efectivos viven **en la proyección**, nunca en el payload de un evento.

Formance los persiste en la transacción porque su log *es* su modelo de lectura; aquí el event
store está separado, y grabar un derivado en el evento violaría INV-5 y el principio de diseño
#2. Se reconstruyen por replay como toda proyección (RNF-5).

### AC-9: Rebuild verificado antes de que nadie dependa de esto

`ConsistencyVerifier` valida los volúmenes efectivos contra el stream, y el rebuild completo
reproduce valores idénticos a la proyección incremental — incluido el caso con transacciones
back-dated intercaladas.

Ninguna query se apoya en volúmenes efectivos hasta que esta verificación pase.

## Reglas de Negocio

- El recálculo hacia adelante es la parte delicada de esta historia: debe ser idempotente y
  correr dentro de la transacción del proyector. Es la razón por la que Formance trata esta
  capacidad como opcional y desactivable.
- Esta es la historia más cara del set. Si su costo real supera lo estimado, el orden de
  ejecución permite pararla sin bloquear a `hu-0029`, que solo depende de `hu-0027`.

## Fuera de Alcance

- Volúmenes efectivos sobre transacciones pendientes (AC-2 lo excluye deliberadamente).
- Exponer el saldo corrido en el API: esta historia produce el dato; qué endpoint lo devuelve y
  con qué forma es parte del contrato que toca `hu-0030`.
